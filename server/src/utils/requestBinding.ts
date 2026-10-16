import prisma from '../models/prisma.js';

/**
 * Поиск подходящего визита для привязки заявки по serialNumber.
 * Используется при импорте заявок, добавлении задачи и завершении визита.
 */
export async function findMatchingVisit(
  addressId: string,
  contractId: string | null,
  equipmentTypeCode: string,
  serialNumber: string,
  startDate: Date,
  deadline: Date,
  excludeVisitId?: string,
): Promise<{ id: string } | null> {
  const baseWhere = {
    addressId,
    isDeleted: false,
    status: { not: 'awaiting_assignment' as const },
    dateStart: { gte: startDate, lte: deadline },
    ...(contractId ? { contractId } : {}),
    ...(excludeVisitId ? { id: { not: excludeVisitId } } : {}),
  };

  const visit = await prisma.visit.findFirst({
    where: {
      ...baseWhere,
      tasks: {
        some: {
          taskType: { not: 'group_climate' },
          equipmentType: { code: equipmentTypeCode },
          OR: [
            { serialNumber },
            { objectEquipment: { serialNumber, equipmentTypeCode } },
          ],
        },
      },
      visitRequests: {
        none: {
          importedRequest: {
            equipmentTypeCode,
            serialNumber,
          },
        },
      },
    },
  });
  if (visit) return visit;

  const groupVisit = await prisma.visit.findFirst({
    where: {
      ...baseWhere,
      tasks: {
        some: {
          taskType: 'group_climate',
          equipmentItems: {
            some: {
              objectEquipment: { serialNumber, equipmentTypeCode },
            },
          },
        },
      },
      visitRequests: {
        none: {
          importedRequest: {
            equipmentTypeCode,
            serialNumber,
          },
        },
      },
    },
  });
  return groupVisit;
}

/**
 * Автопривязка ИСЖ-заявок к визиту по адресу и периоду.
 * Используется при создании визита и при завершении.
 */
export async function autoAssignISZHRequests(params: {
  addressId: string;
  visitId: string;
  visitDate: Date;
  contractId: string | null;
  engineerId: string;
  options?: {
    createVisitEngineer?: boolean;
    createAssignmentLog?: boolean;
    reason?: string;
  };
}): Promise<{ requestId: string; externalRequestId: string }[]> {
  const { addressId, visitId, visitDate, contractId, engineerId, options = {} } = params;
  const { createVisitEngineer = false, createAssignmentLog = false, reason } = options;
  const bound: { requestId: string; externalRequestId: string }[] = [];

  const requests = await prisma.importedRequest.findMany({
    where: {
      matchedAddressId: addressId,
      equipmentType: { code: 'iszh_object' },
      startDate: { lte: visitDate },
      deadline: { gte: visitDate },
      NOT: { visitRequests: { some: { visitId } } },
    },
    include: {
      equipmentType: true,
      visit: { include: { visitEngineers: true } },
    },
    orderBy: { importedAt: 'asc' },
  });

  // Дедупликация по периоду
  const seenPeriods = new Set<string>();
  const uniqueRequests = requests.filter(r => {
    const periodKey = `${r.startDate?.toISOString()}_${r.deadline?.toISOString()}`;
    if (seenPeriods.has(periodKey)) return false;
    seenPeriods.add(periodKey);
    return true;
  });

  let primaryAssigned = false;

  for (const request of uniqueRequests) {
    const existingLink = await prisma.visitRequest.findUnique({
      where: { visitId_importedRequestId: { visitId, importedRequestId: request.id } },
    });
    if (existingLink) continue;

    await prisma.visitRequest.create({ data: { visitId, importedRequestId: request.id } });
    await prisma.importedRequest.update({ where: { id: request.id }, data: { visitId } });

    if (request.contractId && !contractId) {
      await prisma.visit.update({ where: { id: visitId }, data: { contractId: request.contractId } });
    }

    if (createVisitEngineer && !primaryAssigned) {
      const engineer = await prisma.user.findUnique({
        where: { id: engineerId },
        select: { fullName: true },
      });
      await prisma.visitEngineer.create({
        data: { visitId, engineerId, isPrimary: true, assignedBy: engineerId },
      });
      await prisma.visit.update({
        where: { id: visitId },
        data: { engineerName: engineer?.fullName || '' },
      });
      primaryAssigned = true;
    }

    if (createAssignmentLog) {
      await prisma.requestAssignmentLog.create({
        data: {
          importedRequestId: request.id,
          action: 'assigned',
          engineerId,
          performedBy: engineerId,
          reason: reason || 'Автоматически при создании визита',
        },
      });
    }

    bound.push({ requestId: request.id, externalRequestId: request.externalRequestId });
  }

  return bound;
}

/**
 * Автопривязка не-ИСЖ заявок к визиту по serialNumber задач.
 */
export async function autoAssignBySerialNumber(params: {
  addressId: string;
  visitId: string;
  visitDate: Date;
  contractId: string | null;
  tasks: Array<{
    id: string;
    taskType: string;
    equipmentTypeCode?: string;
    serialNumber?: string | null;
    objectEquipment?: { serialNumber?: string | null; equipmentTypeCode: string } | null;
    equipmentItems?: Array<{ objectEquipment: { serialNumber?: string | null; equipmentTypeCode: string } }>;
  }>;
  options?: {
    createAssignmentLog?: boolean;
    engineerId?: string;
    reason?: string;
  };
}): Promise<{ requestId: string; externalRequestId: string; taskId: string }[]> {
  const { addressId, visitId, visitDate, contractId, tasks, options = {} } = params;
  const { createAssignmentLog = false, engineerId, reason } = options;
  const bound: { requestId: string; externalRequestId: string; taskId: string }[] = [];

  for (const task of tasks) {
    const eqCode = task.equipmentTypeCode;
    if (!eqCode || eqCode === 'iszh_object') continue;

    if (task.taskType === 'group_climate' && task.equipmentItems) {
      for (const item of task.equipmentItems) {
        if (!item.objectEquipment?.serialNumber) continue;
        const matched = await prisma.importedRequest.findFirst({
          where: {
            matchedAddressId: addressId,
            equipmentTypeCode: item.objectEquipment.equipmentTypeCode,
            serialNumber: item.objectEquipment.serialNumber,
            startDate: { lte: visitDate },
            deadline: { gte: visitDate },
            visitRequests: { none: {} },
            ...(contractId ? { contractId } : {}),
          },
        });
        if (matched) {
          await bindRequestToVisit(matched.id, visitId, contractId);
          if (createAssignmentLog && engineerId) {
            await prisma.requestAssignmentLog.create({
              data: {
                importedRequestId: matched.id, action: 'assigned', engineerId, performedBy: engineerId,
                reason: reason || `Автоматически (задача ${task.id}, SN: ${item.objectEquipment.serialNumber})`,
              },
            });
          }
          bound.push({ requestId: matched.id, externalRequestId: matched.externalRequestId, taskId: task.id });
        }
      }
    } else {
      const taskSN = task.serialNumber || task.objectEquipment?.serialNumber;
      if (!taskSN) continue;
      const matched = await prisma.importedRequest.findFirst({
        where: {
          matchedAddressId: addressId,
          equipmentTypeCode: eqCode,
          serialNumber: taskSN,
          startDate: { lte: visitDate },
          deadline: { gte: visitDate },
          visitRequests: { none: {} },
          ...(contractId ? { contractId } : {}),
        },
      });
      if (matched) {
        await bindRequestToVisit(matched.id, visitId, contractId);
        if (createAssignmentLog && engineerId) {
          await prisma.requestAssignmentLog.create({
            data: {
              importedRequestId: matched.id, action: 'assigned', engineerId, performedBy: engineerId,
              reason: reason || `Автоматически (задача ${task.id}, SN: ${taskSN})`,
            },
          });
        }
        bound.push({ requestId: matched.id, externalRequestId: matched.externalRequestId, taskId: task.id });
      }
    }
  }

  return bound;
}

async function bindRequestToVisit(requestId: string, visitId: string, visitContractId: string | null) {
  await prisma.visitRequest.create({ data: { visitId, importedRequestId: requestId } });
  await prisma.importedRequest.update({ where: { id: requestId }, data: { visitId } });
  if (visitContractId) {
    // Синхронизация contractId не нужна — он уже установлен при создании визита
  }
}
