export type AiProvider = 'claude';

export interface AiAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  extractedText?: string | null;
  storagePath: string;
}

export interface AiChatPayload {
  provider: AiProvider;
  model: string;
  prompt: string;
  diagramSnapshot: unknown;
  attachments: AiAttachment[];
}

export interface AiChatResult {
  assistantMessage: string;
  ops: unknown[];
}
