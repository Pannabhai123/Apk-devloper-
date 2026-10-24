import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { config } from '../config.js';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (msg = 'Invalid request', details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have permission to perform this action') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg = 'Conflict', details?: unknown) => new HttpError(409, msg, details);
export const tooMany = (msg = 'Too many requests. Please try again shortly.') => new HttpError(429, msg);

export function send<T>(res: Response, data: T, status = 200, meta?: Record<string, unknown>) {
  return res.status(status).json(meta ? { ok: true, data, meta } : { ok: true, data });
}

export function sendError(res: Response, err: unknown) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ ok: false, error: err.message, details: err.details ?? null });
  }
  if (err instanceof ZodError) {
    return res.status(422).json({
      ok: false,
      error: 'Validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  const errorId = crypto.randomUUID();
  if (config.isProd) {
    // Never log raw error objects in production: they can contain SQL text,
    // bound values, absolute paths or personal data. Only a correlation id and
    // a scrubbed summary reach the log; the raw error stays server-side only.
    console.error('[error]', JSON.stringify({
      errorId,
      name: err instanceof Error ? err.name : 'Error',
      message: scrubForLog(err instanceof Error ? err.message : 'Unexpected server error'),
    }));
  } else {
    console.error('[error]', err);
  }
  const message = err instanceof Error ? err.message : 'Unexpected server error';
  return res.status(500).json({ ok: false, error: configSafeMessage(message), errorId });
}

function scrubForLog(message: string): string {
  return message
    .replace(/(?:\/[A-Za-z0-9._-]+){2,}/g, '[path]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b(?:SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*/i, '[query redacted]')
    .slice(0, 300);
}

// Never leak internal SQL/file details to clients, but keep useful constraint hints.
function configSafeMessage(message: string): string {
  if (message.includes('UNIQUE constraint failed')) return 'A record with these details already exists.';
  if (message.includes('FOREIGN KEY constraint failed')) return 'A related record does not exist.';
  if (message.includes('CHECK constraint failed')) return 'A value is outside the allowed range.';
  return 'An unexpected error occurred. Please try again.';
}

export function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ ok: false, error: 'Endpoint not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  sendError(res, err);
}
