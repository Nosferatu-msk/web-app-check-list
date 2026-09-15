import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const METER_CODES = ['schetchik_electroshc', 'schetchik_hvs', 'schetchik_gvs', 'meter_gas'];

/**
 * Генерирует serialNumber для оборудования по правилу:
 * Код объекта + "/" + вид оборудования (код) + "/" + порядковый номер
 *
 * @param addressId ID адреса
 * @param equipmentTypeCode Код типа оборудования
 * @returns Сгенерированный serialNumber или null если objectCode отсутствует
 */
export async function generateSerialNumber(
  addressId: string,
  equipmentTypeCode: string
): Promise<string | null> {
  // Счётчики не автогенерируются
  if (METER_CODES.includes(equipmentTypeCode)) {
    return null;
  }

  // Получаем objectCode из адреса
  const address = await prisma.address.findUnique({
    where: { id: addressId },
    select: { objectCode: true },
  });

  if (!address?.objectCode) {
    return null;
  }

  // Получаем все существующие serialNumber для этого типа на объекте
  const existingEquipment = await prisma.objectEquipment.findMany({
    where: {
      addressId,
      equipmentTypeCode,
      serialNumber: { not: null },
    },
    select: { serialNumber: true },
  });

  // Находим максимальный порядковый номер
  let maxSeqNumber = 0;
  const prefix = `${address.objectCode}/${equipmentTypeCode}/`;
  
  for (const eq of existingEquipment) {
    if (eq.serialNumber && eq.serialNumber.startsWith(prefix)) {
      const seqPart = eq.serialNumber.substring(prefix.length);
      const seqNum = parseInt(seqPart, 10);
      if (!isNaN(seqNum) && seqNum > maxSeqNumber) {
        maxSeqNumber = seqNum;
      }
    }
  }

  const seqNumber = maxSeqNumber + 1;
  return `${address.objectCode}/${equipmentTypeCode}/${seqNumber}`;
}

/**
 * Проверяет, является ли тип оборудования счётчиком
 */
export function isMeterEquipment(equipmentTypeCode: string): boolean {
  return METER_CODES.includes(equipmentTypeCode);
}
