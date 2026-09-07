import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import { Task, TaskStatus, Conclusion } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { useSyncStore } from '../sync/engine';
import NetInfo from '@react-native-community/netinfo';
import { getLocalTasks, getLocalTask } from '../storage/offlineStorage';
import {
  getCachedEquipmentTypes,
  getCachedRoomTypes,
  getCachedRecommendations,
} from '../services/refCache';

export function useEquipmentTypes() {
  return useQuery({
    queryKey: ['equipment-types'],
    queryFn: async () => {
      try {
        const response = await api.get('/refs/equipment-types');
        return response.data as { id: string; name: string; code: string; photosRequired: number }[];
      } catch {
        const cached = await getCachedEquipmentTypes();
        return cached.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          photosRequired: 1,
        }));
      }
    },
    staleTime: 10 * 60 * 1000,
    refetchOnReconnect: 'always',
  });
}

export function useRoomTypes() {
  return useQuery({
    queryKey: ['room-types'],
    queryFn: async () => {
      try {
        const response = await api.get('/refs/room-types');
        return response.data as { id: string; name: string; code: string }[];
      } catch {
        const cached = await getCachedRoomTypes();
        return cached.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code || undefined,
        }));
      }
    },
    staleTime: 10 * 60 * 1000,
    refetchOnReconnect: 'always',
  });
}

export function useEquipmentRooms(addressId: string) {
  return useQuery({
    queryKey: ['equipment-rooms', addressId],
    queryFn: async () => {
      const response = await api.get('/refs/object-equipment/rooms', {
        params: { address_id: addressId },
      });
      return response.data as { room_type_id: string; room_type_name: string; room_type_code: string; count: number }[];
    },
    enabled: !!addressId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useObjectEquipment(addressId: string, params?: { binding_level?: string; room_type_code?: string }) {
  return useQuery({
    queryKey: ['object-equipment', addressId, params],
    queryFn: async () => {
      const response = await api.get('/refs/object-equipment', {
        params: { address_id: addressId, ...params },
      });
      return response.data as {
        id: string;
        equipment_type_id: string;
        equipment_type_name: string;
        equipment_type_code: string;
        room_type_id: string;
        room_type_name: string;
        brand: string;
        model: string;
        serial_number: string;
      }[];
    },
    enabled: !!addressId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const addToQueue = useSyncStore((state) => state.addToQueue);

  return useMutation({
    mutationFn: async ({
      visitId,
      data,
    }: {
      visitId: string;
      data: {
        equipmentTypeId: string;
        roomTypeId?: string;
        roomTypeCode?: string;
        taskType?: string;
      };
    }) => {
      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

      const taskId = `local_task_${uuidv4()}`;

      const cachedEqTypes = await getCachedEquipmentTypes();
      const eqType = cachedEqTypes.find((e) => e.id === data.equipmentTypeId);
      const eqTypeName = eqType?.name || '';

      const cachedRoomTypes = await getCachedRoomTypes();
      const roomType = cachedRoomTypes.find((r) => r.id === data.roomTypeId);
      const roomTypeName = roomType?.name || '';

      if (!isOnline) {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO tasks (id, visit_id, equipment_type_id, equipment_type_name, room_type_id, room_type_name, task_type, status, dirty, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            taskId,
            visitId,
            data.equipmentTypeId,
            eqTypeName,
            data.roomTypeId || null,
            roomTypeName,
            data.taskType || 'individual',
            'not_started',
            new Date().toISOString(),
          ]
        );

        await addToQueue({
          client_mutation_id: uuidv4(),
          entity_type: 'task',
          entity_id: taskId,
          action: 'create',
          payload: {
            id: taskId,
            visitId,
            equipmentTypeId: data.equipmentTypeId,
            equipmentTypeName: eqTypeName,
            roomTypeId: data.roomTypeId,
            roomTypeName,
            roomTypeCode: data.roomTypeCode,
            taskType: data.taskType || 'individual',
          },
        });

        queryClient.invalidateQueries({ queryKey: ['visit', visitId] });
        queryClient.invalidateQueries({ queryKey: ['tasks', visitId] });

        return {
          id: taskId,
          visit_id: visitId,
          equipment_type_id: data.equipmentTypeId,
          equipment_type_name: eqTypeName,
          equipment_type_code: eqType?.code || '',
          room_type_id: data.roomTypeId || '',
          room_type_name: roomTypeName,
          room_type_code: data.roomTypeCode || '',
          task_type: data.taskType || 'individual',
          status: 'not_started' as TaskStatus,
          photos_count: 0,
          created_at: new Date().toISOString(),
        } as Task;
      }

      const response = await api.post(`/visits/${visitId}/tasks`, data);
      queryClient.invalidateQueries({ queryKey: ['visit', visitId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', visitId] });
      return response.data as Task;
    },
  });
}

export function useTasks(visitId: string) {
  return useQuery({
    queryKey: ['tasks', visitId],
    queryFn: async () => {
      try {
        const response = await api.get(`/visits/${visitId}/tasks`);
        return response.data as Task[];
      } catch {
        return await getLocalTasks(visitId);
      }
    },
    enabled: !!visitId,
    refetchOnReconnect: 'always',
  });
}

export function useTask(visitId: string, taskId: string) {
  return useQuery({
    queryKey: ['task', visitId, taskId],
    queryFn: async () => {
      try {
        const response = await api.get(`/visits/${visitId}/tasks/${taskId}`);
        return response.data as Task;
      } catch {
        const local = await getLocalTask(taskId);
        if (local) return local;
        throw new Error('Задача не найдена');
      }
    },
    enabled: !!visitId && !!taskId,
    refetchOnReconnect: 'always',
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const addToQueue = useSyncStore((state) => state.addToQueue);

  return useMutation({
    mutationFn: async ({
      visitId,
      taskId,
      data,
    }: {
      visitId: string;
      taskId: string;
      data: Partial<Task>;
    }) => {
      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

      if (!isOnline) {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE tasks SET parameters = ?, status = ?, conclusion = ?, additional_recommendations = ?, selected_recommendation_ids = ?, dirty = 1, updated_at = ? WHERE id = ?`,
          [
            data.parameters ? JSON.stringify(data.parameters) : null,
            data.status || 'in_progress',
            data.conclusion || null,
            data.additional_recommendations || null,
            data.selected_recommendation_ids ? JSON.stringify(data.selected_recommendation_ids) : null,
            new Date().toISOString(),
            taskId,
          ]
        );

        await addToQueue({
          client_mutation_id: uuidv4(),
          entity_type: 'task',
          entity_id: taskId,
          action: 'update',
          payload: {
            parameters: data.parameters,
            status: data.status,
            conclusion: data.conclusion,
            additionalRecommendations: data.additional_recommendations,
            selectedRecommendationIds: data.selected_recommendation_ids,
          },
        });

        queryClient.invalidateQueries({ queryKey: ['tasks', visitId] });
        queryClient.invalidateQueries({ queryKey: ['task', visitId, taskId] });
        queryClient.invalidateQueries({ queryKey: ['visit', visitId] });

        return { id: taskId, ...data } as Task;
      }

      const response = await api.put(`/visits/${visitId}/tasks/${taskId}`, data);
      queryClient.invalidateQueries({ queryKey: ['tasks', visitId] });
      queryClient.invalidateQueries({ queryKey: ['task', visitId, taskId] });
      queryClient.invalidateQueries({ queryKey: ['visit', visitId] });
      return response.data as Task;
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  const addToQueue = useSyncStore((state) => state.addToQueue);

  return useMutation({
    mutationFn: async ({
      visitId,
      taskId,
      status,
    }: {
      visitId: string;
      taskId: string;
      status: TaskStatus;
    }) => {
      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

      if (!isOnline) {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE tasks SET status = ?, dirty = 1, updated_at = ? WHERE id = ?`,
          [status, new Date().toISOString(), taskId]
        );

        await addToQueue({
          client_mutation_id: uuidv4(),
          entity_type: 'task',
          entity_id: taskId,
          action: 'update',
          payload: { status },
        });

        queryClient.invalidateQueries({ queryKey: ['tasks', visitId] });
        queryClient.invalidateQueries({ queryKey: ['visit', visitId] });

        return { id: taskId, status } as Task;
      }

      const response = await api.put(`/visits/${visitId}/tasks/${taskId}`, { status });
      queryClient.invalidateQueries({ queryKey: ['tasks', visitId] });
      queryClient.invalidateQueries({ queryKey: ['visit', visitId] });
      return response.data as Task;
    },
  });
}

export interface Recommendation {
  id: string;
  text: string;
  equipment_type_code?: string;
}

export function useRecommendations(equipmentTypeCode?: string) {
  return useQuery({
    queryKey: ['recommendations', equipmentTypeCode],
    queryFn: async () => {
      try {
        const params = equipmentTypeCode ? { equipment_type_code: equipmentTypeCode } : {};
        const response = await api.get('/refs/recommendations', { params });
        return response.data as Recommendation[];
      } catch {
        const cached = await getCachedRecommendations(equipmentTypeCode);
        return cached.map((c) => ({
          id: c.id,
          text: c.text,
          equipment_type_code: c.equipment_type_code || undefined,
        }));
      }
    },
    enabled: !!equipmentTypeCode,
    staleTime: 10 * 60 * 1000,
    refetchOnReconnect: 'always',
  });
}
