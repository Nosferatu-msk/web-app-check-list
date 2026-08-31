import { v4 as uuidv4 } from 'uuid';
import { useSyncStore, SyncMutation } from './engine';
import { getDatabase } from '../db';

/**
 * Хук для создания мутаций и добавления их в очередь синхронизации.
 */
export function useSyncMutation() {
  const addToQueue = useSyncStore((state) => state.addToQueue);

  const createVisit = async (visitData: any) => {
    const mutation: SyncMutation = {
      client_mutation_id: uuidv4(),
      entity_type: 'visit',
      entity_id: visitData.id || `local_${Date.now()}`,
      action: 'create',
      payload: visitData,
    };

    // Сохраняем в локальную БД
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO visits (id, address_id, address, date, time_start, season, status, dirty, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        mutation.entity_id,
        visitData.address_id,
        visitData.address,
        visitData.date,
        visitData.time_start,
        visitData.season,
        visitData.status || 'not_started',
        new Date().toISOString(),
      ]
    );

    // Добавляем в очередь синхронизации
    await addToQueue(mutation);

    return mutation.entity_id;
  };

  const updateVisit = async (visitId: string, updates: any) => {
    const mutation: SyncMutation = {
      client_mutation_id: uuidv4(),
      entity_type: 'visit',
      entity_id: visitId,
      action: 'update',
      payload: updates,
    };

    // Обновляем локальную БД
    const db = await getDatabase();
    
    if (updates.status) {
      await db.runAsync(
        `UPDATE visits SET status = ?, dirty = 1, updated_at = ? WHERE id = ?`,
        [updates.status, new Date().toISOString(), visitId]
      );
    }

    await addToQueue(mutation);
  };

  const createTask = async (taskData: any) => {
    const mutation: SyncMutation = {
      client_mutation_id: uuidv4(),
      entity_type: 'task',
      entity_id: taskData.id || `local_task_${Date.now()}`,
      action: 'create',
      payload: taskData,
    };

    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO tasks (id, visit_id, equipment_type_id, equipment_type_name, room_type_id, room_type_name, status, dirty, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        mutation.entity_id,
        taskData.visit_id,
        taskData.equipment_type_id,
        taskData.equipment_type_name,
        taskData.room_type_id,
        taskData.room_type_name,
        taskData.status || 'not_started',
        new Date().toISOString(),
      ]
    );

    await addToQueue(mutation);

    return mutation.entity_id;
  };

  const updateTask = async (taskId: string, updates: any) => {
    const mutation: SyncMutation = {
      client_mutation_id: uuidv4(),
      entity_type: 'task',
      entity_id: taskId,
      action: 'update',
      payload: updates,
    };

    const db = await getDatabase();
    
    if (updates.parameters) {
      await db.runAsync(
        `UPDATE tasks SET parameters = ?, status = ?, conclusion = ?, additional_recommendations = ?, dirty = 1, updated_at = ? WHERE id = ?`,
        [
          JSON.stringify(updates.parameters),
          updates.status || 'in_progress',
          updates.conclusion,
          updates.additional_recommendations,
          new Date().toISOString(),
          taskId,
        ]
      );
    } else {
      await db.runAsync(
        `UPDATE tasks SET status = ?, dirty = 1, updated_at = ? WHERE id = ?`,
        [updates.status, new Date().toISOString(), taskId]
      );
    }

    await addToQueue(mutation);
  };

  return {
    createVisit,
    updateVisit,
    createTask,
    updateTask,
  };
}
