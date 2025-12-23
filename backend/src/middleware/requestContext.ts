import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithId extends Request {
  requestId?: string;
}

const DEFAULT_TIMEOUT_MS = 15000;

export const requestContext = (
  req: RequestWithId,
  res: Response,
  next: NextFunction
) => {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && incomingId ? incomingId : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.setTimeout(DEFAULT_TIMEOUT_MS, () => {
    if (res.headersSent) return;
    res.status(504).json({ error: 'リクエストがタイムアウトしました', requestId });
  });

  next();
};
