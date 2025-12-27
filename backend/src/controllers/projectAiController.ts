import { Response } from 'express';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import { prisma } from '../db/prisma';
import type { AuthRequest } from '../middleware/auth';
import { decryptSecret } from '../utils/crypto';
import { buildClaudeContent, sendClaudeMessage } from '../services/ai/claudeClient';
import type { AiAttachment } from '../services/ai/types';

const MAX_TOKENS = 4096;
const MAX_INPUT_CHARS = 100000; // Approximate limit for input (about 25k tokens)
const MAX_HISTORY_MESSAGES = 10; // Maximum number of history messages to include
const PROVIDER_CLAUDE = 'claude';

const SYSTEM_PROMPT = `You are an expert GSN (Goal Structuring Notation) assistant.
Follow the GSN Community Standard:
- Goal nodes (G) represent claims to be supported.
- Strategy nodes (S) explain reasoning steps that decompose goals.
- Context (C), Assumption (A), and Justification (J) provide side information and connect horizontally.
- Evidence nodes (E) support goals or strategies.
- Supported-by links connect Goal/Strategy to Strategy/Goal/Evidence (use "solid" type).
- In-context-of links connect Goal/Strategy to Context/Assumption/Justification (use "dashed" type).

You must return a single JSON object with the following shape:
{
  "assistantMessage": "string",
  "ops": [
    { "type": "addNode" | "updateNode" | "deleteNode" | "addLink" | "deleteLink" | "moveNode", ... }
  ]
}

For addNode operations:
{ "type": "addNode", "id": "temp_1", "nodeType": "Goal" | "Strategy" | "Context" | "Evidence" | "Assumption" | "Justification" | "Undeveloped" | "Module", "content": "description text" }
- You MUST include a temporary "id" (like "temp_1", "temp_2") for each new node so links can reference them.
- Use these temp IDs in addLink operations to connect nodes you just created.

For addLink operations:
{ "type": "addLink", "source": "node_id", "target": "node_id", "linkType": "solid" | "dashed" }
- source and target can be existing node IDs or temp IDs from addNode ops.
- Use "solid" for SupportedBy (vertical hierarchy), "dashed" for InContextOf (horizontal context).

For updateNode operations:
{ "type": "updateNode", "nodeId": "existing_id", "content": "new text" }

IMPORTANT RULES:
1. If the user asks to CREATE something, you MUST include addNode and addLink ops even if similar nodes already exist.
2. If the user asks to MODIFY or UPDATE, use updateNode ops.
3. If the user asks to DELETE, use deleteNode/deleteLink ops.
4. Never claim something is "already done" without providing ops - always execute the requested action.
5. When creating a GSN structure, create ALL necessary nodes and links in a single response.

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

// Truncate diagram data if it exceeds the limit
const truncateDiagramData = (
  nodes: DiagramNodeSummary[],
  links: DiagramLinkSummary[],
  maxChars: number,
): { nodes: DiagramNodeSummary[]; links: DiagramLinkSummary[]; truncated: boolean } => {
  const nodeLines = nodes.map((node) => {
    const content = stripHtml(node.content);
    return `- ${node.id} [${node.type || 'Unknown'}] ${node.label || ''} ${content}`;
  });
  const linkLines = links.map((link) => `- ${link.source} -> ${link.target} (${link.type || 'solid'})`);

  const totalLength = nodeLines.join('\n').length + linkLines.join('\n').length;

  if (totalLength <= maxChars) {
    return { nodes, links, truncated: false };
  }

  // Truncate nodes to fit within limit
  const truncatedNodes: DiagramNodeSummary[] = [];
  let currentLength = 0;
  const avgLinkLength = linkLines.join('\n').length / (links.length || 1);
  const reservedForLinks = Math.min(avgLinkLength * links.length, maxChars * 0.3);

  for (const node of nodes) {
    const content = stripHtml(node.content);
    const line = `- ${node.id} [${node.type || 'Unknown'}] ${node.label || ''} ${content}`;
    if (currentLength + line.length > maxChars - reservedForLinks) {
      break;
    }
    truncatedNodes.push(node);
    currentLength += line.length + 1;
  }

  // Only include links that reference included nodes
  const nodeIds = new Set(truncatedNodes.map((n) => n.id));
  const truncatedLinks = links.filter(
    (link) => nodeIds.has(link.source) && nodeIds.has(link.target),
  );

  return { nodes: truncatedNodes, links: truncatedLinks, truncated: true };
};

// Build conversation history for Claude API
type ClaudeMessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

const buildConversationHistory = async (
  conversationId: string,
  maxMessages: number,
): Promise<Array<{ role: 'user' | 'assistant'; content: ClaudeMessageContent[] }>> => {
  // 最新N件を取得するため、降順で取得してから逆順にする
  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: maxMessages,
    select: {
      role: true,
      content: true,
    },
  });

  // 時系列順（古い順）に並び替え
  return messages.reverse().map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: [{ type: 'text' as const, text: msg.content }],
  }));
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

  const { nodes: rawNodes, links: rawLinks } = extractDiagramSnapshot(diagramSnapshot);

  // Truncate diagram data if too large
  const { nodes, links, truncated } = truncateDiagramData(rawNodes, rawLinks, MAX_INPUT_CHARS);
  if (truncated) {
    console.log(`[chatWithAi] ダイアグラムデータを切り詰めました: ${rawNodes.length} -> ${nodes.length} ノード`);
  }

  const nodeLines = nodes.map((node) => {
    const content = stripHtml(node.content);
    return `- ${node.id} [${node.type || 'Unknown'}] ${node.label || ''} ${content}`;
  });
  const linkLines = links.map((link) => `- ${link.source} -> ${link.target} (${link.type || 'solid'})`);

  const userPayload = [
    `User request:\n${prompt}`,
    `Current diagram nodes:\n${nodeLines.join('\n') || '(none)'}`,
    `Current diagram links:\n${linkLines.join('\n') || '(none)'}`,
    truncated ? '(Note: Diagram was truncated due to size limits)' : '',
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

  // Build conversation history for context
  const history = await buildConversationHistory(conversation.id, MAX_HISTORY_MESSAGES);

  const content = buildClaudeContent(userPayload, images);
  const apiKey = decryptSecret(credential.encryptedApiKey);

  // Build messages array with history + current message
  const messagesForApi = [
    ...history,
    { role: 'user' as const, content },
  ];

  try {
    const raw = await sendClaudeMessage(apiKey, {
      model,
      system: SYSTEM_PROMPT,
      messages: messagesForApi,
      max_tokens: MAX_TOKENS,
    });

    console.log('[chatWithAi] Raw AI response:', raw.substring(0, 2000));

    let parsed = extractJson(raw);
    console.log('[chatWithAi] Parsed ops count:', parsed?.ops?.length ?? 0);
    if (parsed?.ops?.length > 0) {
      console.log('[chatWithAi] First 3 ops:', JSON.stringify(parsed.ops.slice(0, 3), null, 2));
    }

    let assistantMessage =
      parsed && typeof parsed.assistantMessage === 'string' ? parsed.assistantMessage : raw;
    let ops = parsed && Array.isArray(parsed.ops) ? parsed.ops : [];

    // Only retry if parsing completely failed (not just empty ops)
    // Empty ops is valid for explanation requests
    if (!parsed) {
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
