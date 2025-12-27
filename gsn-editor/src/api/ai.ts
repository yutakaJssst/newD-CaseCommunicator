import { api } from '../services/api';
import type { NodeType } from '../types/diagram';

export type AiProvider = 'claude';

export type AiOp =
  | {
      type: 'addNode';
      nodeType: NodeType;
      anchor?: string;
      direction?: 'up' | 'down' | 'left' | 'right';
      content?: string;
      label?: string;
    }
  | {
      type: 'updateNode';
      nodeId: string;
      content?: string;
      label?: string;
    }
  | {
      type: 'deleteNode';
      nodeId: string;
    }
  | {
      type: 'addLink';
      source: string;
      target: string;
      linkType?: 'solid' | 'dashed';
    }
  | {
      type: 'deleteLink';
      linkId: string;
    }
  | {
      type: 'moveNode';
      nodeId: string;
      x: number;
      y: number;
    };

export interface AiCredentialStatus {
  provider: AiProvider;
  configured: boolean;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  opsJson?: AiOp[] | null;
  createdAt: string;
}

export interface AiAttachment {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  extractedText?: string | null;
}

export interface AiChatResponse {
  conversationId: string;
  assistantMessage: string;
  ops: AiOp[];
}

export const aiApi = {
  async getCredentials(): Promise<{ providers: AiCredentialStatus[] }> {
    const response = await api.get('/ai/credentials');
    return response.data;
  },

  async setCredential(provider: AiProvider, apiKey: string): Promise<AiCredentialStatus> {
    const response = await api.post('/ai/credentials', { provider, apiKey });
    return response.data;
  },

  async deleteCredential(provider: AiProvider): Promise<void> {
    await api.delete(`/ai/credentials/${provider}`);
  },

  async createConversation(
    projectId: string,
    provider: AiProvider,
    model: string,
    title?: string,
  ): Promise<{ conversationId: string }> {
    const response = await api.post(`/projects/${projectId}/ai/conversations`, {
      provider,
      model,
      title,
    });
    return response.data;
  },

  async getMessages(projectId: string, conversationId: string): Promise<{ messages: AiMessage[] }> {
    const response = await api.get(
      `/projects/${projectId}/ai/conversations/${conversationId}/messages`,
    );
    return response.data;
  },

  async uploadAttachment(
    projectId: string,
    file: File,
    conversationId?: string,
  ): Promise<AiAttachment> {
    const form = new FormData();
    form.append('file', file);
    if (conversationId) {
      form.append('conversationId', conversationId);
    }
    const response = await api.post(`/projects/${projectId}/ai/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async sendChat(
    projectId: string,
    payload: {
      conversationId?: string;
      provider: AiProvider;
      model: string;
      prompt: string;
      diagramSnapshot: unknown;
      attachments?: string[];
    },
  ): Promise<AiChatResponse> {
    const response = await api.post(`/projects/${projectId}/ai/chat`, payload);
    return response.data;
  },
};
