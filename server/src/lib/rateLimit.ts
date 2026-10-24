import type { NextFunction, Request, Response } from 'express';
import { tooMany } from './http.js';

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

export function rateLimit(options: { windowMs: number; max: number; prefix?: string; keyFn?: (req: Request) => string }) {
  const { windowMs, max, prefix = 'rl' } = options;
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${prefix}:${options.keyFn ? options.keyFn(req) : req.ip || 'unknown'}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return next(tooMany(`Too many attempts. Try again in ${Math.ceil((bucket.resetAt - now) / 60000)} minute(s).`));
    }
    next();
  };
}

/** Periodic cleanup so the in-memory limiter cannot grow unbounded. */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 5 * 60 * 1000).unref();

export function resetRateLimits() {
  buckets.clear();
}
