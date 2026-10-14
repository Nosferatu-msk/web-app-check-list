import prisma from '../models/prisma.js';

/**
 * Поиск подходящего визита для привязки заявки по serialNumber.
 * Используется при импорте заявок, добавлении задачи и завершении визита.
 *
 * @param addressId - адрес визита
 * @param contractId - договор визита (null → проверка пропускается)
 * @param equipmentTypeCode - код типа оборудования
 * @param serialNumber - серийный номер
 * @param startDate - начало периода заявки
 * @param deadline - конец периода заявки
 * @param excludeVisitId - ID визита, который нужно исключить (для предотвращения самопривязки)
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
  // Базовые условия для всех поисков
  const baseWhere = {
    addressId,
    isDeleted: false,
    status: { not: 'awaiting_assignment' as const }, // только реальные визиты
    dateStart: { gte: startDate, lte: deadline },
    ...(contractId ? { contractId } : {}),
    ...(excludeVisitId ? { id: { not: excludeVisitId } } : {}),
  };

  // 1. Поиск по individual задачам
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
      // Заявка с таким serialNumber ещё не привязана к этому визиту
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

  // 2. Поиск по group_climate задачам (через TaskEquipmentItem)
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
