import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VISIT_ID = '184f81e8-d737-4c61-9fc5-272cede040c1';

async function diagnose() {
  console.log('=== ДИАГНОСТИКА ВИЗИТА ===\n');

  // 1. Получаем визит
  const visit = await prisma.visit.findUnique({
    where: { id: VISIT_ID },
    include: { address: true },
  });

  if (!visit) {
    console.log('Визит не найден');
    return;
  }

  console.log('Визит:', visit.id);
  console.log('Адрес:', visit.address?.fullAddress);
  console.log('Статус:', visit.status);
  console.log('');

  // 2. Получаем все задачи в визите
  const tasks = await prisma.task.findMany({
    where: { visitId: VISIT_ID },
    include: {
      equipmentType: true,
      objectEquipment: true,
      photos: true,
      equipmentItems: {
        include: {
          objectEquipment: true,
          photos: true,
        },
      },
    },
  });

  console.log(`Найдено задач: ${tasks.length}\n`);

  for (const task of tasks) {
    console.log('---');
    console.log('Задача:', task.id);
    console.log('Тип:', task.taskType);
    console.log('Оборудование:', task.equipmentType?.name, `(${task.equipmentType?.code})`);
    console.log('ObjectEquipment (прямая связь):', task.objectEquipment?.id || 'нет');
    if (task.objectEquipment) {
      console.log('  - SN:', task.objectEquipment.serialNumber);
      console.log('  - Brand:', task.objectEquipment.brand);
      console.log('  - Model:', task.objectEquipment.model);
    }
    console.log('Фото задачи:', task.photos.length);
    for (const photo of task.photos) {
      console.log(`  - ${photo.id}: ${photo.fileName} (${photo.moment})`);
    }

    if (task.equipmentItems.length > 0) {
      console.log(`\nЕдиницы оборудования в задаче: ${task.equipmentItems.length}`);
      for (const item of task.equipmentItems) {
        console.log(`  - Item: ${item.id}`);
        console.log(`    ObjectEquipment: ${item.objectEquipment?.id}`);
        console.log(`    SN: ${item.objectEquipment?.serialNumber}`);
        console.log(`    Brand: ${item.objectEquipment?.brand}`);
        console.log(`    Model: ${item.objectEquipment?.model}`);
        console.log(`    Фото: ${item.photos.length}`);
        for (const photo of item.photos) {
          console.log(`      - ${photo.id}: ${photo.fileName} (${photo.moment})`);
        }
      }
    }
    console.log('');
  }

  // 3. Получаем все ObjectEquipment для этого адреса
  console.log('\n=== ВСЁ ОБОРУДОВАНИЕ АДРЕСА ===\n');

  const allEquipment = await prisma.objectEquipment.findMany({
    where: { addressId: visit.addressId },
    include: {
      equipmentProposals: true,
    },
  });

  // Фильтруем только приборы учёта э/э
  const meterEquipment = allEquipment.filter(eq => eq.equipmentTypeCode === 'schetchik_electroshc');

  console.log(`Приборов учёта э/э на адресе: ${meterEquipment.length}\n`);

  for (const eq of meterEquipment) {
    console.log('---');
    console.log('ObjectEquipment:', eq.id);
    console.log('SN:', eq.serialNumber);
    console.log('Brand:', eq.brand);
    console.log('Model:', eq.model);
    console.log('Room:', eq.roomTypeCode);
    console.log('Статус подтверждения:', eq.confirmationStatus);
    console.log('Создано:', eq.createdAt);
    console.log('Proposals:', eq.equipmentProposals.length);
    for (const proposal of eq.equipmentProposals) {
      console.log(`  - ${proposal.id}: ${proposal.status} (${proposal.requestType})`);
      console.log(`    Serial: ${proposal.serialNumber}`);
      console.log(`    Создано: ${proposal.createdAt}`);
    }
  }

  // 4. Получаем все proposals для этого адреса
  console.log('\n=== ВСЕ PROPOSALS АДРЕСА ===\n');

  const allProposals = await prisma.equipmentProposal.findMany({
    where: { addressId: visit.addressId },
    include: {
      objectEquipment: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const meterProposals = allProposals.filter(p => p.equipmentTypeCode === 'schetchik_electroshc');

  console.log(`Proposals для приборов учёта э/э: ${meterProposals.length}\n`);

  for (const proposal of meterProposals) {
    console.log('---');
    console.log('Proposal:', proposal.id);
    console.log('Status:', proposal.status);
    console.log('RequestType:', proposal.requestType);
    console.log('SN:', proposal.serialNumber);
    console.log('Brand:', proposal.brand);
    console.log('Model:', proposal.model);
    console.log('ObjectEquipment ID:', proposal.objectEquipmentId || 'нет');
    console.log('Создано:', proposal.createdAt);
    console.log('Предложил:', proposal.proposedById);
  }

  await prisma.$disconnect();
}

diagnose().catch(console.error);
