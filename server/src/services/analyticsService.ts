import prisma from '../models/prisma.js';
import fs from 'fs';
import path from 'path';

/**
 * Получить список визитов с отклонениями.
 * ТМ видит только своих инженеров, админ — все.
 */
export async function getAnalyticsVisits(params: {
  userId: string;
  role: string;
  page?: number;
  pageSize?: number;
  period?: string;
  engineerId?: string;
  type?: string;
  severity?: string;
  status?: string;
  search?: string;
}) {
  const { userId, role, page = 1, pageSize = 20, period, engineerId, type, severity, status, search } = params;

  // Определяем список engineerId для ТМ
  let allowedEngineerIds: string[] | null = null;
  if (role === 'tm') {
    const tmEngineers = await prisma.tmEngineer.findMany({
      where: { tmId: userId },
      select: { engineerId: true },
    });
    allowedEngineerIds = tmEngineers.map(te => te.engineerId);
  }

  // Период
  let dateFrom: Date | null = null;
  if (period) {
    const now = new Date();
    if (period === '7d') dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === '30d') dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (period === '90d') dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }

  // Базовый фильтр для визитов
  const visitWhere: any = {
    isDeleted: false,
    ...(dateFrom ? { dateStart: { gte: dateFrom } } : {}),
    ...(allowedEngineerIds ? { userId: { in: allowedEngineerIds } } : {}),
    ...(engineerId ? { userId: engineerId } : {}),
  };

  // Поиск по инженеру или адресу
  if (search) {
    visitWhere.OR = [
      { engineerName: { contains: search, mode: 'insensitive' } },
      { address: { fullAddress: { contains: search, mode: 'insensitive' } } },
      { address: { objectCode: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // Фильтр по отклонениям — по умолчанию только open
  const anomalyWhere: any = {};
  if (type) anomalyWhere.type = type;
  if (severity) anomalyWhere.severity = severity;
  anomalyWhere.status = status || 'open';

  const hasAnomalyFilter = type || severity || status;

  // Получаем визиты с отклонениями
  const visitsWithAnomalies = await prisma.visitAnomaly.groupBy({
    by: ['visitId'],
    where: {
      ...anomalyWhere,
      visit: visitWhere,
    },
    _count: { id: true },
  });

  const visitIdsWithAnomalies = visitsWithAnomalies.map(v => v.visitId);

  if (visitIdsWithAnomalies.length === 0) {
    return {
      data: [],
      total: 0,
      summary: { totalVisits: 0, visitsWithAnomalies: 0, criticalCount: 0, warningCount: 0 },
    };
  }

  // Получаем детали визитов
  const visits = await prisma.visit.findMany({
    where: { id: { in: visitIdsWithAnomalies } },
    include: {
      user: { select: { id: true, fullName: true } },
      address: { select: { id: true, fullAddress: true, objectCode: true } },
      anomalies: {
        select: { id: true, type: true, severity: true, status: true },
      },
    },
    orderBy: { dateStart: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Общее количество визитов за период
  const totalVisits = await prisma.visit.count({ where: visitWhere });

  // Сводка
  const data = visits.map(v => {
    const critical = v.anomalies.filter(a => a.severity === 'critical').length;
    const warning = v.anomalies.filter(a => a.severity === 'warning').length;
    const hasOpen = v.anomalies.some(a => a.status === 'open');
    const allConfirmed = v.anomalies.every(a => a.status === 'confirmed');

    return {
      visitId: v.id,
      visitCode: v.address.objectCode || v.address.fullAddress,
      date: v.dateStart.toISOString().split('T')[0],
      engineer: { id: v.user?.id || '', name: v.engineerName || v.user?.fullName || '' },
      address: { id: v.address.id, fullAddress: v.address.fullAddress },
      visitStatus: v.status,
      anomalyCount: { critical, warning },
      reviewStatus: allConfirmed ? 'confirmed' as const : hasOpen ? 'open' as const : 'dismissed' as const,
    };
  });

  // Подсчёт сводки по всем визитам за период
  const allVisitAnomalies = await prisma.visitAnomaly.findMany({
    where: { visit: visitWhere },
    select: { visitId: true, severity: true },
  });

  const uniqueVisitsWithAnomalies = new Set(allVisitAnomalies.map(a => a.visitId));
  const uniqueCriticalVisits = new Set(allVisitAnomalies.filter(a => a.severity === 'critical').map(a => a.visitId));
  const uniqueWarningOnlyVisits = new Set(
    allVisitAnomalies.filter(a => a.severity === 'warning').map(a => a.visitId)
  );
  // Визиты только с warning (без critical)
  for (const vId of uniqueCriticalVisits) {
    uniqueWarningOnlyVisits.delete(vId);
  }

  return {
    data,
    total: uniqueVisitsWithAnomalies.size,
    summary: {
      totalVisits,
      visitsWithAnomalies: uniqueVisitsWithAnomalies.size,
      criticalCount: uniqueCriticalVisits.size,
      warningCount: uniqueWarningOnlyVisits.size,
    },
  };
}

/**
 * Получить детали визита с отклонениями.
 */
export async function getAnalyticsVisitDetails(visitId: string, userId: string, role: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      user: { select: { id: true, fullName: true } },
      address: { select: { id: true, fullAddress: true, objectCode: true } },
      anomalies: {
        include: {
          photo: {
            select: {
              id: true, fileName: true, filePath: true, moment: true,
              verificationStatus: true, verificationDetails: true,
              capturedAt: true, gpsLat: true, gpsLng: true, photoSource: true, phash: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      tasks: {
        include: {
          photos: {
            select: {
              id: true, fileName: true, moment: true,
              verificationStatus: true, verificationDetails: true,
              capturedAt: true, gpsLat: true, gpsLng: true, photoSource: true, phash: true,
            },
          },
          equipmentItems: {
            include: {
              photos: {
                select: {
                  id: true, fileName: true, moment: true,
                  verificationStatus: true, verificationDetails: true,
                  capturedAt: true, gpsLat: true, gpsLng: true, photoSource: true, phash: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!visit) return null;

  // Проверка доступа для ТМ
  if (role === 'tm') {
    const tmEngineer = await prisma.tmEngineer.findFirst({
      where: { tmId: userId, engineerId: visit.userId || undefined },
    });
    if (!tmEngineer) return null;
  }

  // Собираем все фото визита
  const allPhotos: any[] = [];
  for (const task of visit.tasks) {
    for (const p of task.photos) {
      allPhotos.push({ ...p, taskEquipmentItemId: null });
    }
    for (const ei of task.equipmentItems) {
      for (const p of ei.photos) {
        allPhotos.push({ ...p, taskEquipmentItemId: ei.id });
      }
    }
  }

  return {
    visitId: visit.id,
    visitCode: visit.address.objectCode || visit.address.fullAddress,
    address: visit.address.fullAddress,
    engineer: { id: visit.user?.id || '', name: visit.engineerName || visit.user?.fullName || '' },
    dateStart: visit.dateStart,
    timeStart: visit.timeStart,
    timeEnd: visit.timeEnd,
    visitStatus: visit.status,
    anomalies: visit.anomalies.map(a => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      status: a.status,
      details: a.details,
      createdAt: a.createdAt,
      reviewedBy: a.reviewedBy,
      reviewedAt: a.reviewedAt,
      photo: a.photo ? {
        id: a.photo.id,
        fileName: a.photo.fileName,
        moment: a.photo.moment,
        verificationStatus: a.photo.verificationStatus,
        verificationDetails: a.photo.verificationDetails,
        capturedAt: a.photo.capturedAt,
        gpsLat: a.photo.gpsLat,
        gpsLng: a.photo.gpsLng,
        photoSource: a.photo.photoSource,
        phash: a.photo.phash,
      } : null,
    })),
    allPhotos: allPhotos.map(p => ({
      id: p.id,
      fileName: p.fileName,
      moment: p.moment,
      verificationStatus: p.verificationStatus,
      verificationDetails: p.verificationDetails,
      capturedAt: p.capturedAt,
      gpsLat: p.gpsLat,
      gpsLng: p.gpsLng,
      photoSource: p.photoSource,
      phash: p.phash,
    })),
  };
}

/**
 * Запрос пересъёмки — удаление аномальных фото.
 */
export async function reshootVisit(visitId: string, anomalyIds: string[], reviewerId: string) {
  const anomalies = await prisma.visitAnomaly.findMany({
    where: { id: { in: anomalyIds }, visitId },
    include: { photo: true },
  });

  if (anomalies.length === 0) {
    throw new Error('Отклонения не найдены');
  }

  // Удаляем фото (физически + из БД)
  for (const anomaly of anomalies) {
    if (anomaly.photo) {
      try {
        fs.unlinkSync(anomaly.photo.filePath);
      } catch { /* ignore */ }
      await prisma.photo.delete({ where: { id: anomaly.photoId! } });
    }
  }

  // Обновляем статусы задач
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      tasks: {
        include: {
          equipmentItems: { include: { photos: true } },
          photos: true,
        },
      },
    },
  });

  if (visit) {
    for (const task of visit.tasks) {
      const hasPhotos = task.photos.length > 0 ||
        task.equipmentItems.some((tei: any) => tei.photos.length > 0);

      if (!hasPhotos && task.status !== 'not_started') {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: 'not_started' },
        });
      }
    }

    // Проверяем статус визита
    const allTasksNotStarted = visit.tasks.every((t: any) => t.status === 'not_started');
    if (allTasksNotStarted && visit.status !== 'in_progress') {
      await prisma.visit.update({
        where: { id: visitId },
        data: { status: 'in_progress' },
      });
    }
  }

  // Помечаем отклонения как confirmed
  await prisma.visitAnomaly.updateMany({
    where: { id: { in: anomalyIds } },
    data: {
      status: 'confirmed',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  });

  return { deletedPhotos: anomalies.filter(a => a.photo).length, updatedAnomalies: anomalies.length };
}

/**
 * Подтверждение визита — все open отклонения → dismissed.
 */
export async function confirmVisit(visitId: string, reviewerId: string) {
  const result = await prisma.visitAnomaly.updateMany({
    where: { visitId, status: 'open' },
    data: {
      status: 'dismissed',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  });

  return { updatedCount: result.count };
}

/**
 * Обновить статус одного отклонения.
 */
export async function updateAnomalyStatus(anomalyId: string, status: string, reviewerId: string) {
  return prisma.visitAnomaly.update({
    where: { id: anomalyId },
    data: {
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  });
}
