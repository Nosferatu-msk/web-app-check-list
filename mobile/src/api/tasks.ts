import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import { Task, TaskStatus, Conclusion } from '../types';

export function useEquipmentTypes() {
  return useQuery({
    queryKey: ['equipment-types'],
    queryFn: async () => {
      const response = await api.get('/refs/equipment-types');
      return response.data as { id: string; name: string; code: string; photosRequired: number }[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useRoomTypes() {
  return useQuery({
    queryKey: ['room-types'],
    queryFn: async () => {
      const response = await api.get('/refs/room-types');
      return response.data as { id: string; name: string; code: string }[];
    },
    staleTime: 10 * 60 * 1000,
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
      const response = await api.post(`/visits/${visitId}/tasks`, data);
      return response.data as Task;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visit', variables.visitId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.visitId] });
    },
  });
}

export function useTasks(visitId: string) {
  return useQuery({
    queryKey: ['tasks', visitId],
    queryFn: async () => {
      const response = await api.get(`/visits/${visitId}/tasks`);
      return response.data as Task[];
    },
    enabled: !!visitId,
  });
}

export function useTask(visitId: string, taskId: string) {
  return useQuery({
    queryKey: ['task', visitId, taskId],
    queryFn: async () => {
      const response = await api.get(`/visits/${visitId}/tasks/${taskId}`);
      return response.data as Task;
    },
    enabled: !!visitId && !!taskId,
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

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
      const response = await api.put(`/visits/${visitId}/tasks/${taskId}`, data);
      return response.data as Task;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.visitId] });
      queryClient.invalidateQueries({ queryKey: ['task', variables.visitId, variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['visit', variables.visitId] });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

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
      const response = await api.put(`/visits/${visitId}/tasks/${taskId}`, { status });
      return response.data as Task;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.visitId] });
      queryClient.invalidateQueries({ queryKey: ['visit', variables.visitId] });
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
      const params = equipmentTypeCode ? { equipment_type_code: equipmentTypeCode } : {};
      const response = await api.get('/refs/recommendations', { params });
      return response.data as Recommendation[];
    },
    enabled: !!equipmentTypeCode,
    staleTime: 10 * 60 * 1000,
  });
}
