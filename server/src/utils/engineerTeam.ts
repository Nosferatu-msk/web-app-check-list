import prisma from '../models/prisma.js';

/**
 * Получить ID всех инженеров, доступных ТМ:
 * - Свои инженеры (TmEngineer where tmId)
 * - Если ТМ — лидер: инженеры всех ТМ2 команды
 * - Если ТМ — ТМ2 (член команды): инженеры лидера
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

  // 3. Если ТМ — ТМ2 (член команды): добавить инженеры лидера
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

/**
 * Получить ID инженера, к которому привязан текущий инженер через ТМ
 * Возвращает null, если инженер не привязан к ТМ или ТМ не имеет команды
 */
export async function getEngineerTeamTmId(engineerId: string): Promise<string | null> {
  const assignment = await prisma.tmEngineer.findUnique({
    where: { engineerId },
    select: { tmId: true },
  });
  return assignment?.tmId || null;
}

/**
 * Проверить, находится ли визит в процессе редактирования другим инженером
 * Возвращает информацию о текущем редакторе или null
 */
export async function getVisitEditor(visitId: string, currentUserId: string): Promise<{ engineerId: string; fullName: string } | null> {
  // Получаем визит с информацией о текущем редакторе
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      userId: true,
      status: true,
      editingEngineerId: true,
      editingStartedAt: true,
      user: { select: { id: true, fullName: true } },
    },
  });

  if (!visit) return null;

  // Если визит завершён или отправлен — он не редактируется
  if (['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'].includes(visit.status)) {
    return null;
  }

  // Проверяем, установлен ли флаг редактирования
  if (visit.editingEngineerId && visit.editingEngineerId !== currentUserId) {
    // Проверяем, что сессия редактирования не устарела (более 30 минут)
    if (visit.editingStartedAt) {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (visit.editingStartedAt > thirtyMinutesAgo) {
        // Сессия активна — возвращаем информацию о редакторе
        return {
          engineerId: visit.editingEngineerId,
          fullName: visit.user?.fullName || 'Неизвестно',
        };
      }
    }
  }

  return null;
}

/**
 * Проверить, может ли инженер редактировать визит
 * Возвращает { canEdit: boolean, reason?: string }
 * Использует транзакцию для атомарной проверки и установки блокировки
 */
export async function canEngineEditVisit(visitId: string, engineerId: string): Promise<{ canEdit: boolean; reason?: string; editor?: { engineerId: string; fullName: string } }> {
  // Используем транзакцию для атомарной проверки и установки блокировки
  const result = await prisma.$transaction(async (tx) => {
    const visit = await tx.visit.findUnique({
      where: { id: visitId },
      select: {
        userId: true,
        status: true,
        user: { select: { id: true, fullName: true } },
        visitEngineers: {
          where: { engineerId },
          select: { engineerId: true },
        },
        editingEngineerId: true,
        editingStartedAt: true,
      },
    });

    if (!visit) {
      return { canEdit: false, reason: 'Визит не найден' };
    }

    // Если визит завершён или отправлен — редактирование запрещено
    if (['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'].includes(visit.status)) {
      return { canEdit: false, reason: 'Визит завершён или отправлен и не может быть изменён' };
    }

    // Проверяем, установлена ли блокировка другим инженером
    if (visit.editingEngineerId && visit.editingEngineerId !== engineerId) {
      // Проверяем, что сессия редактирования не устарела (более 5 минут)
      if (visit.editingStartedAt) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (visit.editingStartedAt > fiveMinutesAgo) {
          // Блокировка активна — возвращаем информацию о редакторе
          console.log(`[edit-lock] Визит ${visitId} заблокирован инженером ${visit.editingEngineerId} (до ${visit.editingStartedAt.toISOString()})`);
          return {
            canEdit: false,
            reason: `Визит в настоящее время редактируется инженером ${visit.user?.fullName || 'другим инженером'}`,
            editor: {
              engineerId: visit.editingEngineerId,
              fullName: visit.user?.fullName || 'Неизвестно',
            },
          };
        } else {
          console.log(`[edit-lock] Блокировка визита ${visitId} устарела (была установлена ${visit.editingStartedAt.toISOString()})`);
        }
      }
    }

    // Инженер может редактировать — устанавливаем блокировку
    await tx.visit.update({
      where: { id: visitId },
      data: {
        editingEngineerId: engineerId,
        editingStartedAt: new Date(),
      },
    });
    
    console.log(`[edit-lock] Инженер ${engineerId} установил блокировку на визит ${visitId}`);

    return { canEdit: true };
  });

  return result;
}

/**
 * Снять блокировку редактирования визита
 */
export async function releaseVisitEditLock(visitId: string, engineerId: string): Promise<void> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { editingEngineerId: true },
  });

  if (visit && visit.editingEngineerId === engineerId) {
    await prisma.visit.update({
      where: { id: visitId },
      data: {
        editingEngineerId: null,
        editingStartedAt: null,
      },
    });
    console.log(`[edit-lock] Инженер ${engineerId} снял блокировку с визита ${visitId}`);
  }
}
