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
  console.log('Шаг 1: Свои инженеры (tm_engineer.tmId = tmId):');
  console.log('  Найдено:', ownEngineers.length);
  for (const e of ownEngineers) ids.add(e.engineerId);

  // 2. Если ТМ — лидер: добавить инженеров всех ТМ2
  const teamMembers = await prisma.tmTeamMember.findMany({
    where: { leadTmId: tmId },
    select: { memberTmId: true },
  });
  console.log('\nШаг 2: Команды, где ТМ — лидер (tm_team_member.leadTmId = tmId):');
  console.log('  Найдено членов:', teamMembers.length);
  if (teamMembers.length > 0) {
    const memberIds = teamMembers.map(m => m.memberTmId);
    const teamEng = await prisma.tmEngineer.findMany({
      where: { tmId: { in: memberIds } },
      select: { engineerId: true },
    });
    console.log('  Инженеры членов команды:', teamEng.length);
    for (const e of teamEng) ids.add(e.engineerId);
  }

  // 3. Если ТМ — ТМ2 (член команды): добавить инженеров лидера
  const membership = await prisma.tmTeamMember.findUnique({
    where: { memberTmId: tmId },
  });
  console.log('\nШаг 3: Команды, где ТМ — член (tm_team_member.memberTmId = tmId):');
  console.log('  Найдено:', membership ? 1 : 0);
  if (membership) {
    console.log('  Лидер:', membership.leadTmId);
    const leadEng = await prisma.tmEngineer.findMany({
      where: { tmId: membership.leadTmId },
      select: { engineerId: true },
    });
    console.log('  Инженеры лидера:', leadEng.length);
    for (const e of leadEng) ids.add(e.engineerId);
  }

  return [...ids];
}

async function check() {
  console.log('=== Проверка работы getTeamEngineerIds для ТМ_МБ ===\n');

  const tmMbId = 'b9758bf8-cf33-4d13-a741-edbb4d55748f';
  
  const engineerIds = await getTeamEngineerIds(tmMbId);
  
  console.log('\n=== ИТОГО ===');
  console.log('Инженеров найдено:', engineerIds.length);
  
  // Проверяем, есть ли Петров С.В. в списке
  const petrovId = '92b81fc8-d4bd-4bd0-a98b-3cfcc393b716';
  const hasPetrov = engineerIds.includes(petrovId);
  console.log('Петров С.В. в списке:', hasPetrov ? '✅ ДА' : '❌ НЕТ');
}

check().catch(console.error).finally(() => prisma.$disconnect());
