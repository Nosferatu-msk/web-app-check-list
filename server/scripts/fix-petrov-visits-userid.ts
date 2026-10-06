import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  console.log('=== Исправление userId для визитов Петрова С.В. ===\n');

  // Находим договор
  const contract = await prisma.contract.findFirst({
    where: { number: '050005596590' },
    select: { id: true }
  });
  
  if (!contract) {
    console.log('❌ Договор не найден');
    return;
  }
  
  console.log('✅ Договор найден:', contract.id);
  
  const from = new Date('2026-09-01T00:00:00');
  const to = new Date('2026-09-30T23:59:59');
  
  // ID ТМ_МБ (текущий неправильный userId)
  const tmMbId = 'b9758bf8-cf33-4d13-a741-edbb4d55748f';
  
  // ID Петрова С.В. (правильный userId)
  const petrovId = '92b81fc8-d4bd-4bd0-a98b-3cfcc393b716';
  
  // Находим визиты с userId = ТМ_МБ и engineerName = "Петров С.В."
  const visits = await prisma.visit.findMany({
    where: {
      contractId: contract.id,
      isDeleted: false,
      dateStart: { gte: from, lte: to },
      userId: tmMbId,
      engineerName: 'Петров С.В.'
    },
    select: {
      id: true,
      dateStart: true,
      engineerName: true,
      userId: true
    }
  });
  
  console.log('\n📊 Найдено визитов для исправления:', visits.length);
  
  if (visits.length === 0) {
    console.log('✅ Нет визитов для исправления');
    return;
  }
  
  console.log('\nВизиты:');
  visits.forEach(v => {
    console.log(`  - ${v.id}: ${v.dateStart.toLocaleDateString('ru-RU')}, ${v.engineerName}`);
  });
  
  // Подтверждение
  console.log('\n⚠️  Будет обновлено', visits.length, 'визитов');
  console.log('   Текущий userId:', tmMbId, '(ТМ_МБ)');
  console.log('   Новый userId:', petrovId, '(Петров С.В.)');
  
  // Обновляем визиты
  const result = await prisma.visit.updateMany({
    where: {
      id: { in: visits.map(v => v.id) }
    },
    data: {
      userId: petrovId
    }
  });
  
  console.log('\n✅ Обновлено визитов:', result.count);
  
  // Проверяем результат
  const updatedVisits = await prisma.visit.findMany({
    where: {
      id: { in: visits.map(v => v.id) }
    },
    select: {
      id: true,
      userId: true,
      engineerName: true
    }
  });
  
  console.log('\n🔍 Проверка результата:');
  updatedVisits.forEach(v => {
    console.log(`  - ${v.id}: userId=${v.userId}, engineerName=${v.engineerName}`);
  });
  
  const allCorrect = updatedVisits.every(v => v.userId === petrovId);
  if (allCorrect) {
    console.log('\n✅ Все визиты успешно обновлены!');
  } else {
    console.log('\n❌ Ошибка: не все визиты обновлены корректно');
  }
}

fix().catch(console.error).finally(() => prisma.$disconnect());
