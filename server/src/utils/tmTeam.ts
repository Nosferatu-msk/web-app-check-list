import prisma from '../models/prisma.js';

/**
 * Получить ID всех инженеров, доступных ТМ (включая инженеров ТМ2 его команды).
 */
export async function getTeamEngineerIds(tmId: string): Promise<string[]> {
  const ownEngineers = await prisma.tmEngineer.findMany({
    where: { tmId },
    select: { engineerId: true },
  });

  const teamMembers = await prisma.tmTeamMember.findMany({
    where: { leadTmId: tmId },
    select: { memberTmId: true },
  });

  let teamEngineers: string[] = [];
  if (teamMembers.length > 0) {
    const memberIds = teamMembers.map(m => m.memberTmId);
    const teamEng = await prisma.tmEngineer.findMany({
      where: { tmId: { in: memberIds } },
      select: { engineerId: true },
    });
    teamEngineers = teamEng.map(e => e.engineerId);
  }

  return [...new Set([...ownEngineers.map(e => e.engineerId), ...teamEngineers])];
}
