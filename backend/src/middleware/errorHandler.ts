import type { Response, NextFunction } from 'express';
import type { RequestWithId } from './requestContext';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: RequestWithId,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const requestId = req.requestId;

  console.error('[Error]', {
    statusCode,
    message,
    requestId,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    error: message,
    ...(requestId && { requestId }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const createError = (statusCode: number, message: string): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
