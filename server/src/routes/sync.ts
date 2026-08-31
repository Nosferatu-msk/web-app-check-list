import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { processBatchSync, SyncMutationInput } from '../services/syncService.js';

const router = Router();

const mutationSchema = z.object({
  client_mutation_id: z.string().uuid(),
  entity_type: z.enum(['visit', 'task', 'photo']),
  entity_id: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  payload: z.any()
});

const batchSyncSchema = z.object({
  mutations: z.array(mutationSchema).min(1).max(50)
});

/**
 * POST /api/sync/batch
 * Пакетная синхронизация мутаций от мобильного приложения.
 * Принимает до 50 мутаций за запрос.
 * Идемпотентность: повторная отправка той же мутации возвращает кэшированный результат.
 */
router.post('/batch', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const validation = batchSyncSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Невалидные данные', details: validation.error.flatten() });
      return;
    }

    const { mutations } = validation.data as { mutations: SyncMutationInput[] };
    const userId = req.userId!;

    const results = await processBatchSync(userId, mutations);

    // Подсчёт статистики
    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      total: results.length,
      completed,
      failed,
      results
    });
  } catch (error: any) {
    console.error('Batch sync error:', error);
    res.status(500).json({ error: error.message || 'Ошибка синхронизации' });
  }
});

export default router;
