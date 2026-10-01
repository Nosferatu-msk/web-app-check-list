import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Обновление brand/model для РЩ/ГРЩ...');

  // 1. Находим тип оборудования rsch
  const rschType = await prisma.equipmentType.findUnique({ where: { code: 'rsch' } });
  if (!rschType) {
    console.error('Тип оборудования rsch не найден');
    process.exit(1);
  }
  console.log(`Тип оборудования rsch найден: ${rschType.id}`);

  // 2. Обновляем задачи (tasks) с типом rsch
  const tasksResult = await prisma.task.updateMany({
    where: { equipmentTypeId: rschType.id },
    data: { brand: 'ЦРКСП', model: 'РЩ/ГРЩ' },
  });
  console.log(`Обновлено задач: ${tasksResult.count}`);

  // 3. Обновляем оборудование объектов (object_equipment) с типом rsch
  const equipmentResult = await prisma.objectEquipment.updateMany({
    where: { equipmentTypeCode: 'rsch' },
    data: { brand: 'ЦРКСП', model: 'РЩ/ГРЩ' },
  });
  console.log(`Обновлено оборудования объектов: ${equipmentResult.count}`);

  // 4. Обновляем предложения по оборудованию (equipment_proposals) с типом rsch
  const proposalsResult = await prisma.equipmentProposal.updateMany({
    where: { equipmentTypeCode: 'rsch' },
    data: { brand: 'ЦРКСП', model: 'РЩ/ГРЩ' },
  });
  console.log(`Обновлено предложений: ${proposalsResult.count}`);

  console.log('Готово!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
