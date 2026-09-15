import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const METER_CODES = ['schetchik_electroshc', 'schetchik_hvs', 'schetchik_gws', 'meter_gas'];

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

  // Считаем существующее оборудование с serialNumber для этого типа на объекте
  const existingCount = await prisma.objectEquipment.count({
    where: {
      addressId,
      equipmentTypeCode,
      serialNumber: { not: null },
    },
  });

  const seqNumber = existingCount + 1;
  return `${address.objectCode}/${equipmentTypeCode}/${seqNumber}`;
}

/**
 * Проверяет, является ли тип оборудования счётчиком
 */
export function isMeterEquipment(equipmentTypeCode: string): boolean {
  return METER_CODES.includes(equipmentTypeCode);
}
