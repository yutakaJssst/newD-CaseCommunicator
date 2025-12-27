import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithId extends Request {
  requestId?: string;
}

const DEFAULT_TIMEOUT_MS = 15000;
const AI_TIMEOUT_MS = 120000; // 2 minutes for AI requests

export const requestContext = (
  req: RequestWithId,
  res: Response,
  next: NextFunction
) => {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && incomingId ? incomingId : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Use longer timeout for AI chat endpoint
  const isAiRequest = req.path.endsWith('/ai/chat');
  const timeoutMs = isAiRequest ? AI_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  res.setTimeout(timeoutMs, () => {
    if (res.headersSent) return;
    res.status(504).json({ error: 'リクエストがタイムアウトしました', requestId });
  });

  next();
};
