import type { NextFunction, Request, Response } from 'express';
import { z, type ZodSchema } from 'zod';

export function parse<T extends ZodSchema>(schema: T, input: unknown): z.infer<T> {
  return schema.parse(input);
}

export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body ?? {});
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const idParam = z.coerce.number().int().positive();

export const limits = {
  title: z.string().trim().min(2).max(160),
  shortText: z.string().trim().max(500),
  longText: z.string().trim().max(12000),
  slug: z.string().trim().min(2).max(90).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens'),
  count: z.coerce.number().int().min(1).max(200),
  minutes: z.coerce.number().int().min(1).max(600),
  score: z.coerce.number().min(0).max(1000),
};

export const questionStatus = z.enum(['draft', 'published', 'archived']);
export const difficulty = z.enum(['easy', 'medium', 'hard']);
export const qtype = z.enum(['single', 'multiple']);
export const language = z.enum(['en', 'hi']);
export const displayLanguage = z.enum(['en', 'hi', 'bilingual']);
