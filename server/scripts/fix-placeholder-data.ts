import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLACEHOLDER_PATTERNS = [/^\.+$/, /^-+$/, /^_+$/, /^\/+$/, /^\\+$/, /^нет$/i, /^не заполнено$/i];

const METER_CODES = [
  'schetchik_electroshc', 'schetchik_hvs', 'schetchik_gvs', 'meter_gas',
];

function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return PLACEHOLDER_PATTERNS.some(p => p.test(trimmed));
}

function isMeter(code: string): boolean {
  return METER_CODES.includes(code);
}

async function generateSerialNumber(addressId: string, equipmentTypeCode: string): Promise<string | null> {
  if (isMeter(equipmentTypeCode)) return null;

  const address = await prisma.address.findUnique({
    where: { id: addressId },
    select: { objectCode: true },
  });
  if (!address?.objectCode) return null;

  const existingEquipment = await prisma.objectEquipment.findMany({
    where: { addressId, equipmentTypeCode, serialNumber: { not: null } },
    select: { serialNumber: true },
  });

  let maxSeq = 0;
  const prefix = `${address.objectCode}/${equipmentTypeCode}/`;
  for (const eq of existingEquipment) {
    if (eq.serialNumber?.startsWith(prefix)) {
      const seq = parseInt(eq.serialNumber.substring(prefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }

  return `${address.objectCode}/${equipmentTypeCode}/${maxSeq + 1}`;
}

async function main() {
  console.log('Поиск задач с placeholder-значениями...');

  // Находим все задачи с placeholder в brand, model или serial_number
  const tasks = await prisma.task.findMany({
    include: {
      equipmentType: { select: { id: true, code: true, name: true } },
      visit: { select: { id: true, addressId: true } },
    },
  });

  const tasksToFix = tasks.filter(t =>
    isPlaceholder(t.brand) || isPlaceholder(t.model) || isPlaceholder(t.serialNumber)
  );

  console.log(`Найдено задач с placeholder: ${tasksToFix.length}`);

  let fixed = 0;
  let skipped = 0;

  for (const task of tasksToFix) {
    const eqName = task.equipmentType?.name || 'Оборудование';
    const eqCode = task.equipmentType?.code || '';
    const addressId = task.visit?.addressId;

    const updateData: Record<string, any> = {};

    // Brand → название типа оборудования
    if (isPlaceholder(task.brand)) {
      updateData.brand = eqName;
    }

    // Model → "уточнить"
    if (isPlaceholder(task.model)) {
      updateData.model = 'уточнить';
    }

    // Serial number
    if (isPlaceholder(task.serialNumber)) {
      if (isMeter(eqCode)) {
        updateData.serialNumber = 'уточнить';
      } else if (addressId) {
        const generated = await generateSerialNumber(addressId, eqCode);
        if (generated) {
          updateData.serialNumber = generated;
        } else {
          updateData.serialNumber = 'уточнить';
        }
      } else {
        updateData.serialNumber = 'уточнить';
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.task.update({
        where: { id: task.id },
        data: updateData,
      });
      console.log(`  ✓ ${task.id.slice(0, 8)} (${eqCode}): brand="${updateData.brand || task.brand}", model="${updateData.model || task.model}", sn="${updateData.serialNumber || task.serialNumber}"`);
      fixed++;
    } else {
      skipped++;
    }
  }

  console.log(`\nИтого: исправлено ${fixed}, пропущено ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
