import prisma from '../models/prisma.js';

/**
 * Получить ID всех инженеров, доступных ТМ:
 * - Свои инженеры (TmEngineer where tmId)
 * - Если ТМ — лидер: инженеры всех ТМ2 его команды
 * - Если ТМ — ТМ2 (член команды): инженеры его лидера
 */
export async function getTeamEngineerIds(tmId: string): Promise<string[]> {
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
