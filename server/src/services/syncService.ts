import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SyncMutationInput {
  client_mutation_id: string;
  entity_type: 'visit' | 'task' | 'photo';
  entity_id: string;
  action: 'create' | 'update' | 'delete';
  payload: any;
}

export interface SyncMutationResult {
  client_mutation_id: string;
  status: 'completed' | 'failed' | 'skipped';
  server_id?: string;
  error?: string;
}

/**
 * Пакетная синхронизация мутаций от мобильного приложения.
 * Обрабатывает мутации последовательно (order guarantee).
 * Идемпотентность: если client_mutation_id уже обработан — возвращает кэшированный результат.
 */
export async function processBatchSync(
  userId: string,
  mutations: SyncMutationInput[]
): Promise<SyncMutationResult[]> {
  const results: SyncMutationResult[] = [];

  for (const mutation of mutations) {
    const result = await processSingleMutation(userId, mutation);
    results.push(result);
  }

  return results;
}

async function processSingleMutation(
  userId: string,
  mutation: SyncMutationInput
): Promise<SyncMutationResult> {
  const { client_mutation_id, entity_type, entity_id, action, payload } = mutation;

  // Проверка идемпотентности: если мутация уже обработана — вернуть кэшированный результат
  const existing = await prisma.syncMutation.findUnique({
    where: { clientMutationId: client_mutation_id }
  });

  if (existing) {
    return {
      client_mutation_id,
      status: existing.status as 'completed' | 'failed',
      server_id: existing.resultId || undefined,
      error: existing.error || undefined
    };
  }

  try {
    let server_id: string | undefined;

    switch (entity_type) {
      case 'visit':
        server_id = await processVisitMutation(userId, entity_id, action, payload);
        break;
      case 'task':
        server_id = await processTaskMutation(userId, entity_id, action, payload);
        break;
      case 'photo':
        server_id = await processPhotoMutation(userId, entity_id, action, payload);
        break;
      default:
        throw new Error(`Неизвестный тип сущности: ${entity_type}`);
    }

    // Сохранить результат для идемпотентности
    await prisma.syncMutation.create({
      data: {
        clientMutationId: client_mutation_id,
        userId,
        entityType: entity_type,
        entityId: entity_id,
        action,
        status: 'completed',
        resultId: server_id
      }
    });

    return { client_mutation_id, status: 'completed', server_id };
  } catch (error: any) {
    const errorMessage = error.message || 'Неизвестная ошибка';

    // Сохранить ошибку для идемпотентности
    await prisma.syncMutation.create({
      data: {
        clientMutationId: client_mutation_id,
        userId,
        entityType: entity_type,
        entityId: entity_id,
        action,
        status: 'failed',
        error: errorMessage
      }
    });

    return { client_mutation_id, status: 'failed', error: errorMessage };
  }
}

async function processVisitMutation(
  userId: string,
  entityId: string,
  action: string,
  payload: any
): Promise<string | undefined> {
  switch (action) {
    case 'create': {
      const visit = await prisma.visit.create({
        data: {
          id: payload.id || entityId,
          addressId: payload.address_id,
          dateStart: new Date(payload.date),
          timeStart: payload.time_start || new Date().toTimeString().slice(0, 5),
          season: payload.season,
          status: payload.status || 'not_started',
          userId
        }
      });
      return visit.id;
    }
    case 'update': {
      await prisma.visit.update({
        where: { id: entityId },
        data: {
          status: payload.status,
          updatedAt: new Date()
        }
      });
      return entityId;
    }
    case 'delete': {
      await prisma.visit.update({
        where: { id: entityId },
        data: { isDeleted: true, deletedAt: new Date(), deletedById: userId }
      });
      return entityId;
    }
    default:
      throw new Error(`Неизвестное действие для визита: ${action}`);
  }
}

async function processTaskMutation(
  _userId: string,
  entityId: string,
  action: string,
  payload: any
): Promise<string | undefined> {
  switch (action) {
    case 'create': {
      const task = await prisma.task.create({
        data: {
          id: payload.id || entityId,
          visitId: payload.visit_id,
          equipmentTypeId: payload.equipment_type_id,
          roomTypeId: payload.room_type_id,
          roomTypeCode: payload.room_type_code,
          objectEquipmentId: payload.object_equipment_id,
          status: payload.status || 'not_started'
        }
      });
      return task.id;
    }
    case 'update': {
      await prisma.task.update({
        where: { id: entityId },
        data: {
          status: payload.status,
          parameters: payload.parameters,
          conclusion: payload.conclusion,
          additionalRecommendations: payload.additional_recommendations,
          updatedAt: new Date()
        }
      });
      return entityId;
    }
    case 'delete': {
      await prisma.task.delete({ where: { id: entityId } });
      return entityId;
    }
    default:
      throw new Error(`Неизвестное действие для задачи: ${action}`);
  }
}

async function processPhotoMutation(
  _userId: string,
  entityId: string,
  action: string,
  payload: any
): Promise<string | undefined> {
  switch (action) {
    case 'create': {
      const photo = await prisma.photo.create({
        data: {
          id: payload.id || entityId,
          taskId: payload.task_id,
          moment: payload.moment,
          filePath: payload.file_path,
          fileName: payload.file_name
        }
      });
      return photo.id;
    }
    case 'delete': {
      await prisma.photo.delete({ where: { id: entityId } });
      return entityId;
    }
    default:
      throw new Error(`Неизвестное действие для фото: ${action}`);
  }
}
