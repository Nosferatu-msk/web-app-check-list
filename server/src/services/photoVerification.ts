import prisma from '../models/prisma.js';
import { computePhash, hammingDistance } from '../utils/phash.js';
import { haversineDistance } from '../utils/geo.js';

const PHASH_CRITICAL_THRESHOLD = 4;
const PHASH_WARNING_THRESHOLD = 10;
const GPS_MAX_DISTANCE_METERS = 500;
const TIMESTAMP_BEFORE_TOLERANCE_MIN = 30;
const TIMESTAMP_AFTER_TOLERANCE_MIN = 5;

interface AnomalyInput {
  visitId: string;
  photoId: string | null;
  type: string;
  severity: string;
  details: Record<string, unknown>;
}

/**
 * Главная функция верификации фото.
 * Вызывается асинхронно после загрузки фото.
 */
export async function verifyPhoto(photoId: string): Promise<void> {
  try {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: {
        task: {
          include: {
            visit: { include: { address: true } },
            equipmentType: true,
          },
        },
        taskEquipmentItem: {
          include: {
            objectEquipment: true,
            task: { include: { visit: { include: { address: true } } } },
          },
        },
        mtrVisit: {
          include: {
            address: true,
          },
        },
      },
    });

    if (!photo) return;

    const anomalies: AnomalyInput[] = [];
    const verificationDetails: Array<{
      check: string;
      passed: boolean;
      severity?: string;
      message: string;
      data?: Record<string, unknown>;
    }> = [];

    // Определяем visitId и address
    let visitId: string | null = null;
    let addressLat: number | null = null;
    let addressLng: number | null = null;
    let equipmentTypeId: string | null = null;
    let objectEquipmentId: string | null = null;
    let isMtr = false;

    if (photo.task?.visit) {
      visitId = photo.task.visit.id;
      addressLat = photo.task.visit.address?.latitude ?? null;
      addressLng = photo.task.visit.address?.longitude ?? null;
      equipmentTypeId = photo.task.equipmentTypeId;
    } else if (photo.taskEquipmentItem?.task?.visit) {
      visitId = photo.taskEquipmentItem.task.visit.id;
      addressLat = photo.taskEquipmentItem.task.visit.address?.latitude ?? null;
      addressLng = photo.taskEquipmentItem.task.visit.address?.longitude ?? null;
      objectEquipmentId = photo.taskEquipmentItem.objectEquipmentId;
    } else if (photo.mtrVisit) {
      isMtr = true;
      addressLat = photo.mtrVisit.address?.latitude ?? null;
      addressLng = photo.mtrVisit.address?.longitude ?? null;
    }

    if (!visitId && !isMtr) {
      await prisma.photo.update({
        where: { id: photoId },
        data: { verificationStatus: 'clean' },
      });
      return;
    }

    // 1. pHash — перцептический хэш
    const phashResult = await checkPhash(photo, objectEquipmentId, equipmentTypeId);
    if (phashResult) {
      if (visitId) anomalies.push({ visitId, photoId, type: 'photo_phash_match', severity: phashResult.severity, details: phashResult.details });
      verificationDetails.push({ check: 'phash', passed: false, severity: phashResult.severity, message: phashResult.message, data: phashResult.details });
    } else {
      verificationDetails.push({ check: 'phash', passed: true, message: 'Совпадений не обнаружено' });
    }

    // 2. Timestamp — окно визита
    const tsResult = checkTimestamp(photo, visitId || '');
    if (tsResult) {
      if (visitId) anomalies.push({ visitId, photoId, type: 'photo_timestamp_mismatch', severity: 'critical', details: tsResult });
      verificationDetails.push({ check: 'timestamp', passed: false, severity: 'critical', message: 'Фото сделано вне окна визита', data: tsResult });
    } else {
      verificationDetails.push({ check: 'timestamp', passed: true, message: 'В окне визита' });
    }

    // 3. GPS
    const gpsResult = await checkGps(photo, addressLat, addressLng);
    if (gpsResult) {
      if (visitId) anomalies.push({ visitId, photoId, type: gpsResult.type, severity: 'warning', details: gpsResult.details });
      verificationDetails.push({ check: 'gps', passed: false, severity: 'warning', message: gpsResult.message, data: gpsResult.details });
    } else {
      verificationDetails.push({ check: 'gps', passed: true, message: 'Координаты в норме или недоступны' });
    }

    // 4. Источник фото
    const sourceResult = checkSource(photo);
    if (sourceResult) {
      if (visitId) anomalies.push({ visitId, photoId, type: 'photo_gallery_source', severity: 'warning', details: sourceResult });
      verificationDetails.push({ check: 'source', passed: false, severity: 'warning', message: 'Фото загружено из галереи', data: sourceResult });
    } else {
      verificationDetails.push({ check: 'source', passed: true, message: 'Источник: камера' });
    }

    // Создаём отклонения (только для ТО-визитов, т.к. visit_anomalies FK → visits)
    if (anomalies.length > 0 && visitId) {
      await prisma.visitAnomaly.createMany({
        data: anomalies as any,
      });
    }

    // Определяем итоговый статус
    const hasCritical = anomalies.some(a => a.severity === 'critical');
    const hasWarning = anomalies.some(a => a.severity === 'warning');
    const verificationStatus = hasCritical ? 'suspicious' : hasWarning ? 'warning' : 'clean';

    await prisma.photo.update({
      where: { id: photoId },
      data: {
        verificationStatus,
        verificationDetails: verificationDetails as any,
      },
    });
  } catch (error) {
    console.error(`[photoVerification] Ошибка верификации фото ${photoId}:`, error);
    await prisma.photo.update({
      where: { id: photoId },
      data: { verificationStatus: 'pending' },
    }).catch(() => {});
  }
}

async function checkPhash(
  photo: any,
  objectEquipmentId: string | null,
  equipmentTypeId: string | null
): Promise<{ severity: string; message: string; details: Record<string, unknown> } | null> {
  try {
    const phash = await computePhash(photo.filePath);

    await prisma.photo.update({
      where: { id: photo.id },
      data: { phash },
    });

    // Ищем фото для сравнения — по тому же оборудованию
    let compareWhere: any = {
      id: { not: photo.id },
      phash: { not: null },
    };

    if (photo.taskEquipmentItemId && objectEquipmentId) {
      // Групповая задача — сравниваем по objectEquipmentId
      compareWhere.taskEquipmentItem = { objectEquipmentId };
    } else if (photo.taskId && equipmentTypeId) {
      // Индивидуальная задача — сравниваем по equipmentTypeId в том же визите
      compareWhere.task = {
        visitId: photo.task.visitId,
        equipmentTypeId,
      };
    } else {
      return null;
    }

    const recentPhotos = await prisma.photo.findMany({
      where: compareWhere,
      select: { id: true, phash: true, createdAt: true, taskId: true, taskEquipmentItemId: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    if (recentPhotos.length === 0) return null;

    let bestMatch: { photo: typeof recentPhotos[0]; distance: number } | null = null;

    for (const rp of recentPhotos) {
      if (!rp.phash) continue;
      const distance = hammingDistance(phash, rp.phash);
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { photo: rp, distance };
      }
    }

    if (!bestMatch) return null;

    if (bestMatch.distance <= PHASH_CRITICAL_THRESHOLD) {
      const matchPhoto = await prisma.photo.findUnique({
        where: { id: bestMatch.photo.id },
        include: {
          task: { include: { visit: { include: { address: true, user: true } } } },
          taskEquipmentItem: { include: { task: { include: { visit: { include: { user: true } } } } } },
        },
      });

      let matchInfo = '';
      let matchVisitId = '';
      let matchEngineer = '';

      if (matchPhoto?.task?.visit) {
        matchVisitId = matchPhoto.task.visit.id;
        matchEngineer = matchPhoto.task.visit.user?.fullName || 'неизвестно';
        matchInfo = `Визит от ${matchPhoto.task.visit.dateStart?.toISOString().split('T')[0]}`;
      } else if (matchPhoto?.taskEquipmentItem?.task?.visit) {
        matchVisitId = matchPhoto.taskEquipmentItem.task.visit.id;
        matchEngineer = matchPhoto.taskEquipmentItem.task.visit.user?.fullName || 'неизвестно';
        matchInfo = `Визит от ${matchPhoto.taskEquipmentItem.task.visit.dateStart?.toISOString().split('T')[0]}`;
      }

      return {
        severity: 'critical',
        message: `Визуальное сходство ${Math.round((1 - bestMatch.distance / 64) * 100)}% с другим фото`,
        details: {
          hammingDistance: bestMatch.distance,
          similarityPercent: Math.round((1 - bestMatch.distance / 64) * 100),
          matchedPhotoId: bestMatch.photo.id,
          matchVisitId,
          matchEngineer,
          matchInfo,
        },
      };
    }

    if (bestMatch.distance <= PHASH_WARNING_THRESHOLD) {
      return {
        severity: 'warning',
        message: `Фото очень похоже на другое (расстояние ${bestMatch.distance})`,
        details: {
          hammingDistance: bestMatch.distance,
          similarityPercent: Math.round((1 - bestMatch.distance / 64) * 100),
          matchedPhotoId: bestMatch.photo.id,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('[photoVerification] Ошибка проверки pHash:', error);
    return null;
  }
}

function checkTimestamp(photo: any, visitId: string): Record<string, unknown> | null {
  if (!photo.capturedAt) return null;

  const visit = photo.task?.visit || photo.taskEquipmentItem?.task?.visit;
  if (!visit) return null;

  // Если timeStart отсутствует — не можем определить окно визита
  if (!visit.timeStart) return null;

  const capturedAt = new Date(photo.capturedAt);
  const visitStart = new Date(visit.dateStart);

  // Парсим timeStart (HH:MM) в дату
  const timeParts = visit.timeStart?.split(':');
  if (timeParts) {
    visitStart.setHours(parseInt(timeParts[0]), parseInt(timeParts[1] || '0'), 0);
  }

  const windowStart = new Date(visitStart.getTime() - TIMESTAMP_BEFORE_TOLERANCE_MIN * 60 * 1000);

  let windowEnd: Date;
  if (visit.timeEnd) {
    const endParts = visit.timeEnd.split(':');
    windowEnd = new Date(visitStart);
    windowEnd.setHours(parseInt(endParts[0]), parseInt(endParts[1] || '0'), 0);
  } else {
    windowEnd = new Date(visitStart.getTime() + 12 * 60 * 60 * 1000);
  }
  windowEnd = new Date(windowEnd.getTime() + TIMESTAMP_AFTER_TOLERANCE_MIN * 60 * 1000);

  if (capturedAt < windowStart || capturedAt > windowEnd) {
    return {
      capturedAt: capturedAt.toISOString(),
      visitWindowStart: windowStart.toISOString(),
      visitWindowEnd: windowEnd.toISOString(),
      differenceMinutes: capturedAt < windowStart
        ? Math.round((windowStart.getTime() - capturedAt.getTime()) / 60000)
        : Math.round((capturedAt.getTime() - windowEnd.getTime()) / 60000),
      timingType: capturedAt < windowStart ? 'before_visit' : 'after_visit',
    };
  }

  return null;
}

async function checkGps(
  photo: any,
  addressLat: number | null,
  addressLng: number | null
): Promise<{ type: string; message: string; details: Record<string, unknown> } | null> {
  if (photo.gpsLat == null || photo.gpsLng == null) {
    return {
      type: 'photo_no_gps',
      message: 'GPS-координаты недоступны',
      details: { reason: 'gps_not_available' },
    };
  }

  if (addressLat == null || addressLng == null) {
    return null;
  }

  const distance = haversineDistance(photo.gpsLat, photo.gpsLng, addressLat, addressLng);

  if (distance > GPS_MAX_DISTANCE_METERS) {
    return {
      type: 'photo_gps_mismatch',
      message: `GPS в ${Math.round(distance)} м от адреса объекта`,
      details: {
        photoLat: photo.gpsLat,
        photoLng: photo.gpsLng,
        addressLat,
        addressLng,
        distanceMeters: Math.round(distance),
        maxDistanceMeters: GPS_MAX_DISTANCE_METERS,
      },
    };
  }

  return null;
}

function checkSource(photo: any): Record<string, unknown> | null {
  if (photo.photoSource === 'gallery') {
    return { source: 'gallery', message: 'Фото выбрано из галереи, а не снято камерой' };
  }
  return null;
}
