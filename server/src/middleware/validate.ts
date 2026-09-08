import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      console.error('[validate] Validation error:', JSON.stringify(result.error.flatten(), null, 2));
      console.error('[validate] Request body:', JSON.stringify(req.body, null, 2));
      res.status(400).json({ error: 'Ошибка валидации', details: result.error.flatten() });
      return;
    }
    req.body = result.data;
    next();
  };
}
