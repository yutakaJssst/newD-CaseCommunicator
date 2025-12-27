import { Response } from 'express';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import { prisma } from '../db/prisma';
import type { AuthRequest } from '../middleware/auth';
import { decryptSecret } from '../utils/crypto';
import { buildClaudeContent, sendClaudeMessage } from '../services/ai/claudeClient';
import type { AiAttachment } from '../services/ai/types';

const MAX_TOKENS = 4096;
const PROVIDER_CLAUDE = 'claude';

const SYSTEM_PROMPT = `You are an expert GSN (Goal Structuring Notation) assistant.
Follow the GSN Community Standard:
- Goal nodes (G) represent claims to be supported.
- Strategy nodes (S) explain reasoning steps that decompose goals.
- Context (C), Assumption (A), and Justification (J) provide side information and connect horizontally.
- Evidence nodes (E) support goals or strategies.
- Supported-by links connect Goal/Strategy to Strategy/Goal/Evidence.
- In-context-of links connect Goal/Strategy to Context/Assumption/Justification.

You must return a single JSON object with the following shape:
{
  "assistantMessage": "string",
  "ops": [
    { "type": "addNode" | "updateNode" | "deleteNode" | "addLink" | "deleteLink" | "moveNode", ... }
  ]
}
If the request requires changes, you MUST include ops that implement those changes.
Do not claim completion without providing ops.
If you cannot comply, return ops as an empty array and explain why.
Do not include any additional text outside JSON.`;

const STRICT_JSON_PROMPT = `Return ONLY valid JSON with keys "assistantMessage" and "ops".
The JSON must be parseable without any extra text.
If you need to update nodes, you MUST include updateNode ops with nodeId and content.
Never return markdown or explanations outside JSON.`;

type DiagramNodeSummary = {
  id: string;
  type?: string;
  label?: string | null;
  content?: string | null;
};

type DiagramLinkSummary = {
  source: string;
  target: string;
  type?: string | null;
};

type DiagramSnapshot = {
  nodes: DiagramNodeSummary[];
  links: DiagramLinkSummary[];
};

const stripHtml = (html?: string | null) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
};

const extractDiagramSnapshot = (snapshot: unknown): DiagramSnapshot => {
  if (!snapshot || typeof snapshot !== 'object') {
    return { nodes: [], links: [] };
  }
  const record = snapshot as Record<string, unknown>;
  if (record.modules && typeof record.modules === 'object') {
    const modules = record.modules as Record<string, any>;
    const currentId = typeof record.currentDiagramId === 'string' ? record.currentDiagramId : 'root';
    const moduleData = modules[currentId] || modules.root;
    return {
      nodes: Array.isArray(moduleData?.nodes) ? moduleData.nodes : [],
      links: Array.isArray(moduleData?.links) ? moduleData.links : [],
    };
  }
  return {
    nodes: Array.isArray(record.nodes) ? (record.nodes as DiagramNodeSummary[]) : [],
    links: Array.isArray(record.links) ? (record.links as DiagramLinkSummary[]) : [],
  };
};

const extractJson = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

const buildAttachmentText = (attachments: AiAttachment[]) => {
  return attachments
    .filter((attachment) => attachment.extractedText)
    .map((attachment) => {
      return `Attachment (${attachment.fileName}):\n${attachment.extractedText}`;
    })
    .join('\n\n');
};

const readAttachmentImages = async (attachments: AiAttachment[]) => {
  const imageAttachments = attachments.filter((attachment) =>
    attachment.mimeType.startsWith('image/')
  );
  const images = await Promise.all(
    imageAttachments.map(async (attachment) => {
      const data = await fs.readFile(attachment.storagePath);
      return {
        mediaType: attachment.mimeType,
        data: data.toString('base64'),
      };
    })
  );
  return images;
};

export const createConversation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  const { projectId } = req.params;
  const { provider, model, title } = req.body as {
    provider?: string;
    model?: string;
    title?: string;
  };

  if (!provider || provider !== PROVIDER_CLAUDE) {
    return res.status(400).json({ error: '未対応のプロバイダです' });
  }
  if (!model || typeof model !== 'string') {
    return res.status(400).json({ error: 'モデル指定が必要です' });
  }

  const conversation = await prisma.aiConversation.create({
    data: {
      projectId,
      userId,
      provider,
      model,
      title,
    },
  });

  return res.json({ conversationId: conversation.id });
};

export const getConversationMessages = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  const { projectId, conversationId } = req.params;

  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, projectId, userId },
  });
  if (!conversation) {
    return res.status(404).json({ error: '会話が見つかりません' });
  }

  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      content: true,
      opsJson: true,
      createdAt: true,
    },
  });

  return res.json({ messages });
};

export const uploadAttachment = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  const { projectId } = req.params;
  const { conversationId } = req.body as { conversationId?: string };

  if (!req.file) {
    return res.status(400).json({ error: 'ファイルが必要です' });
  }

  if (conversationId) {
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, projectId, userId },
    });
    if (!conversation) {
      return res.status(404).json({ error: '会話が見つかりません' });
    }
  }

  let extractedText: string | null = null;
  if (req.file.mimetype === 'application/pdf') {
    const buffer = await fs.readFile(req.file.path);
    const parsed = await pdfParse(buffer);
    extractedText = parsed.text.trim();
  }

  const attachment = await prisma.aiAttachment.create({
    data: {
      projectId,
      userId,
      conversationId: conversationId || null,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storagePath: req.file.path,
      extractedText,
    },
  });

  return res.json({
    attachmentId: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    extractedText: attachment.extractedText,
  });
};

export const chatWithAi = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  const { projectId } = req.params;
  const {
    provider,
    model,
    conversationId,
    prompt,
    diagramSnapshot,
    attachments: attachmentIds,
  } = req.body as {
    provider?: string;
    model?: string;
    conversationId?: string;
    prompt?: string;
    diagramSnapshot?: unknown;
    attachments?: string[];
  };

  if (!provider || provider !== PROVIDER_CLAUDE) {
    return res.status(400).json({ error: '未対応のプロバイダです' });
  }
  if (!model || typeof model !== 'string') {
    return res.status(400).json({ error: 'モデル指定が必要です' });
  }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'プロンプトが必要です' });
  }

  let conversation = null;
  if (conversationId) {
    conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, projectId, userId },
    });
    if (!conversation) {
      return res.status(404).json({ error: '会話が見つかりません' });
    }
  } else {
    conversation = await prisma.aiConversation.create({
      data: {
        projectId,
        userId,
        provider,
        model,
        title: prompt.slice(0, 80),
      },
    });
  }

  const credential = await prisma.aiCredential.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });
  if (!credential) {
    return res.status(400).json({ error: 'APIキーが未設定です' });
  }

  const attachmentList = await prisma.aiAttachment.findMany({
    where: {
      id: { in: attachmentIds || [] },
      projectId,
      userId,
    },
  });

  const attachmentText = buildAttachmentText(attachmentList);
  const images = await readAttachmentImages(attachmentList);

  const { nodes, links } = extractDiagramSnapshot(diagramSnapshot);
  const nodeLines = nodes.map((node) => {
    const content = stripHtml(node.content);
    return `- ${node.id} [${node.type || 'Unknown'}] ${node.label || ''} ${content}`;
  });
  const linkLines = links.map((link) => `- ${link.source} -> ${link.target} (${link.type || 'solid'})`);

  const userPayload = [
    `User request:\n${prompt}`,
    `Current diagram nodes:\n${nodeLines.join('\n') || '(none)'}`,
    `Current diagram links:\n${linkLines.join('\n') || '(none)'}`,
    attachmentText ? `Attachments:\n${attachmentText}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  await prisma.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: prompt,
    },
  });

  const content = buildClaudeContent(userPayload, images);
  const apiKey = decryptSecret(credential.encryptedApiKey);

  try {
    const raw = await sendClaudeMessage(apiKey, {
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
      max_tokens: MAX_TOKENS,
    });

    let parsed = extractJson(raw);
    let assistantMessage =
      parsed && typeof parsed.assistantMessage === 'string' ? parsed.assistantMessage : raw;
    let ops = parsed && Array.isArray(parsed.ops) ? parsed.ops : [];

    if (!parsed || ops.length === 0) {
      const retryPayload = [
        STRICT_JSON_PROMPT,
        userPayload,
        'Return JSON now.',
      ]
        .filter(Boolean)
        .join('\n\n');
      const retryContent = buildClaudeContent(retryPayload, images);
      const retryRaw = await sendClaudeMessage(apiKey, {
        model,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: retryContent }],
        max_tokens: MAX_TOKENS,
      });
      parsed = extractJson(retryRaw);
      assistantMessage =
        parsed && typeof parsed.assistantMessage === 'string' ? parsed.assistantMessage : retryRaw;
      ops = parsed && Array.isArray(parsed.ops) ? parsed.ops : [];
    }

    if (!parsed) {
      return res.status(502).json({ error: 'AI応答が不正です。もう一度お試しください。' });
    }

    await prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantMessage,
        opsJson: ops,
      },
    });

    return res.json({
      conversationId: conversation.id,
      assistantMessage,
      ops,
    });
  } catch (error) {
    console.error('[chatWithAi] Error:', error);
    const message = error instanceof Error ? error.message : 'AI通信エラー';
    return res.status(502).json({ error: message });
  }
};
