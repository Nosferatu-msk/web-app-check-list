import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log(`[validate] Path: ${req.path}, Body:`, JSON.stringify(req.body));
    const result = schema.safeParse(req.body);
    if (!result.success) {
      console.error(`[validate] FAILED for ${req.path}:`, JSON.stringify(result.error.issues, null, 2));
      res.status(400).json({ error: 'Ошибка валидации', details: result.error.flatten() });
      return;
    }
    req.body = result.data;
    next();
  };
}
