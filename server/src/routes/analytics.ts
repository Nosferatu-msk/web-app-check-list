import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import prisma from '../models/prisma.js';
import {
  getAnalyticsVisits,
  getAnalyticsVisitDetails,
  reshootVisit,
  confirmVisit,
  updateAnomalyStatus,
} from '../services/analyticsService.js';

const router = Router();
router.use(authMiddleware);

// Middleware: только tm и admin
function requireTmOrAdmin(req: AuthRequest, res: Response, next: Function) {
  if (req.userRole !== 'tm' && req.userRole !== 'admin') {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  next();
}
router.use(requireTmOrAdmin as any);

// GET /api/analytics/visits — список визитов с отклонениями
router.get('/visits', async (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize, period, engineerId, type, severity, status, search } = req.query;

    const p = parseInt(page as string);
    const ps = parseInt(pageSize as string);

    const result = await getAnalyticsVisits({
      userId: req.userId!,
      role: req.userRole!,
      page: (!isNaN(p) && p > 0) ? p : 1,
      pageSize: (!isNaN(ps) && ps > 0 && ps <= 100) ? ps : 20,
      period: period as string,
      engineerId: engineerId as string,
      type: type as string,
      severity: severity as string,
      status: status as string,
      search: search as string,
    });

    res.json(result);
  } catch (err) {
    console.error('[analytics] getAnalyticsVisits error:', err);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// GET /api/analytics/visits/:id — детали визита
router.get('/visits/:id', async (req: AuthRequest, res: Response) => {
  try {
    const visitId = req.params.id as string;
    const result = await getAnalyticsVisitDetails(
      visitId,
      req.userId!,
      req.userRole!
    );

    if (!result) {
      res.status(404).json({ error: 'Визит не найден' });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('[analytics] getAnalyticsVisitDetails error:', err);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// PATCH /api/analytics/anomalies/batch — массовое обновление (ДО :id, чтобы не перехватывалось)
router.patch('/anomalies/batch', async (req: AuthRequest, res: Response) => {
  try {
    const { anomalyIds, status } = req.body;
    if (!Array.isArray(anomalyIds) || anomalyIds.length === 0) {
      res.status(400).json({ error: 'Укажите anomalyIds' });
      return;
    }
    if (!['confirmed', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'Недопустимый статус' });
      return;
    }

    const result = await prisma.visitAnomaly.updateMany({
      where: { id: { in: anomalyIds } },
      data: { status, reviewedBy: req.userId, reviewedAt: new Date() },
    });

    await logAudit({
      userId: req.userId,
      action: 'batch_update_anomalies',
      entityType: 'visit_anomaly',
      entityId: anomalyIds.join(','),
      newValue: { status, count: result.count },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ updated: result.count });
  } catch (err) {
    console.error('[analytics] batch update error:', err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// PATCH /api/analytics/anomalies/:id — обновить статус отклонения
router.patch('/anomalies/:id', async (req: AuthRequest, res: Response) => {
  try {
    const anomalyId = req.params.id as string;
    const { status } = req.body;
    if (!['confirmed', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'Недопустимый статус' });
      return;
    }

    const result = await updateAnomalyStatus(anomalyId, status, req.userId!);

    await logAudit({
      userId: req.userId,
      action: 'update_anomaly_status',
      entityType: 'visit_anomaly',
      entityId: anomalyId,
      newValue: { status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  } catch (err) {
    console.error('[analytics] updateAnomalyStatus error:', err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// POST /api/analytics/visits/:id/reshoot — запрос пересъёмки
router.post('/visits/:id/reshoot', async (req: AuthRequest, res: Response) => {
  try {
    const visitId = req.params.id as string;
    const { anomalyIds } = req.body;
    if (!Array.isArray(anomalyIds) || anomalyIds.length === 0) {
      res.status(400).json({ error: 'Укажите anomalyIds для пересъёмки' });
      return;
    }

    const result = await reshootVisit(visitId, anomalyIds, req.userId!);

    await logAudit({
      userId: req.userId,
      action: 'reshoot_request',
      entityType: 'visit',
      entityId: visitId,
      newValue: { anomalyIds, ...result },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  } catch (err: any) {
    console.error('[analytics] reshoot error:', err);
    res.status(err.message === 'Отклонения не найдены' ? 404 : 500).json({ error: err.message });
  }
});

// POST /api/analytics/visits/:id/confirm — подтверждение визита
router.post('/visits/:id/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const visitId = req.params.id as string;
    const result = await confirmVisit(visitId, req.userId!);

    await logAudit({
      userId: req.userId,
      action: 'confirm_visit_anomalies',
      entityType: 'visit',
      entityId: visitId,
      newValue: result,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  } catch (err) {
    console.error('[analytics] confirm error:', err);
    res.status(500).json({ error: 'Ошибка подтверждения' });
  }
});

export default router;
