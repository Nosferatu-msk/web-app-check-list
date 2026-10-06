import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Копия функции getTeamEngineerIds из utils/tmTeam.ts
async function getTeamEngineerIds(tmId: string): Promise<string[]> {
  const ids = new Set<string>();

  // 1. Свои инженеры
  const ownEngineers = await prisma.tmEngineer.findMany({
    where: { tmId },
    select: { engineerId: true },
  });
  for (const e of ownEngineers) ids.add(e.engineerId);

  // 2. Если ТМ — лидер: добавить инженеров всех ТМ2
  const teamMembers = await prisma.tmTeamMember.findMany({
    where: { leadTmId: tmId },
    select: { memberTmId: true },
  });
  if (teamMembers.length > 0) {
    const memberIds = teamMembers.map(m => m.memberTmId);
    const teamEng = await prisma.tmEngineer.findMany({
      where: { tmId: { in: memberIds } },
      select: { engineerId: true },
    });
    for (const e of teamEng) ids.add(e.engineerId);
  }

  // 3. Если ТМ — ТМ2 (член команды): добавить инженеров лидера
  const membership = await prisma.tmTeamMember.findUnique({
    where: { memberTmId: tmId },
  });
  if (membership) {
    const leadEng = await prisma.tmEngineer.findMany({
      where: { tmId: membership.leadTmId },
      select: { engineerId: true },
    });
    for (const e of leadEng) ids.add(e.engineerId);
  }

  return [...ids];
}

async function diagnose() {
  console.log('=== Диагностика расхождения отчётов по договору 050005596590 ===\n');

  // Находим договор
  const contract = await prisma.contract.findFirst({
    where: { number: '050005596590' },
    select: { id: true, number: true }
  });
  
  if (!contract) {
    console.log('❌ Договор не найден');
    return;
  }
  
  console.log('✅ Договор:', contract.number, 'ID:', contract.id);
  
  // Период
  const from = new Date('2026-09-01T00:00:00');
  const to = new Date('2026-09-30T23:59:59');
  
  console.log('📅 Период: 01.09.2026 - 30.09.2026\n');
  
  // 1. Все визиты по договору (как Админ)
  const allVisits = await prisma.visit.findMany({
    where: {
      contractId: contract.id,
      isDeleted: false,
      dateStart: { gte: from, lte: to },
      status: { in: ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm', 'awaiting_assignment', 'planned', 'not_started', 'in_progress'] },
      userId: { not: null }
    },
    select: { 
      id: true, 
      userId: true, 
      engineerName: true,
      dateStart: true,
      address: { select: { fullAddress: true } }
    }
  });
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 ВСЕ ВИЗИТЫ (как Админ):', allVisits.length);
  console.log('═══════════════════════════════════════════════════════\n');
  
  // 2. Находим ТМ_МБ
  const tmMb = await prisma.user.findFirst({
    where: { email: 'tm_mb@mb.ru' },
    select: { id: true, fullName: true, role: true }
  });
  
  if (!tmMb) {
    console.log('❌ ТМ_МБ не найден');
    return;
  }
  
  console.log('✅ ТМ_МБ:', tmMb.fullName, 'Роль:', tmMb.role, 'ID:', tmMb.id);
  
  // 3. Получаем инженеров ТМ_МБ
  const teamEngineerIds = await getTeamEngineerIds(tmMb.id);
  // Включаем визиты самого ТМ (если ТМ тоже выполнял работы)
  if (!teamEngineerIds.includes(tmMb.id)) {
    teamEngineerIds.push(tmMb.id);
  }
  
  console.log('\n👥 Инженеры команды ТМ_МБ:', teamEngineerIds.length);
  console.log('ID инженеров:', teamEngineerIds);
  
  if (teamEngineerIds.length > 0) {
    const teamEngineers = await prisma.user.findMany({
      where: { id: { in: teamEngineerIds } },
      select: { id: true, fullName: true, email: true }
    });
    console.log('Список инженеров команды:');
    teamEngineers.forEach(e => console.log(`  - ${e.fullName} (${e.email})`));
  }
  
  // 4. Визиты ТМ_МБ (только его инженеры)
  const tmVisits = allVisits.filter(v => teamEngineerIds.includes(v.userId!));
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 ВИЗИТЫ ТМ_МБ:', tmVisits.length);
  console.log('═══════════════════════════════════════════════════════\n');
  
  // 5. Визиты вне команды ТМ_МБ
  const otherVisits = allVisits.filter(v => !teamEngineerIds.includes(v.userId!));
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 ВИЗИТЫ ВНЕ КОМАНДЫ ТМ_МБ:', otherVisits.length);
  console.log('═══════════════════════════════════════════════════════\n');
  
  if (otherVisits.length > 0) {
    console.log('⚠️  Инженеры вне команды ТМ_МБ, которые работали по договору:\n');
    
    // Отладка: проверяем, есть ли userId из otherVisits в teamEngineerIds
    console.log('🔍 Отладка — проверка teamEngineerIds:');
    const firstOtherUserId = otherVisits[0].userId;
    console.log(`  Первый userId из otherVisits: ${firstOtherUserId}`);
    console.log(`  Есть ли он в teamEngineerIds: ${teamEngineerIds.includes(firstOtherUserId!)}`);
    console.log(`  Всего teamEngineerIds: ${teamEngineerIds.length}`);
    
    // Группируем по инженеру
    const byEngineer = new Map<string, { name: string; count: number; visits: any[] }>();
    for (const v of otherVisits) {
      if (!byEngineer.has(v.userId!)) {
        byEngineer.set(v.userId!, { name: v.engineerName, count: 0, visits: [] });
      }
      const eng = byEngineer.get(v.userId!)!;
      eng.count++;
      eng.visits.push(v);
    }

    byEngineer.forEach((data, engineerId) => {
      console.log(`  👤 ${data.name} — ${data.count} визит(ов)`);
      data.visits.forEach(v => {
        const date = v.dateStart.toLocaleDateString('ru-RU');
        console.log(`     • ${date} — ${v.address.fullAddress}`);
      });
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📈 ИТОГО:');
  console.log('  - Все визиты (Админ):', allVisits.length);
  console.log('  - Визиты ТМ_МБ:', tmVisits.length);
  console.log('  - Визиты вне команды ТМ_МБ:', otherVisits.length);
  console.log('  - Разница:', allVisits.length - tmVisits.length);
  console.log('═══════════════════════════════════════════════════════');
}

diagnose().catch(console.error).finally(() => prisma.$disconnect());
