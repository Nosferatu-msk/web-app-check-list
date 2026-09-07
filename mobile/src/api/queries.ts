import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import { Visit, VisitStatus, Task } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { useSyncStore } from '../sync/engine';
import NetInfo from '@react-native-community/netinfo';
import { getLocalVisits, getLocalVisitWithTasks } from '../storage/offlineStorage';

function getSeason(dateStr: string): 'summer' | 'winter' {
  const month = new Date(dateStr).getMonth() + 1;
  return month >= 4 && month <= 10 ? 'summer' : 'winter';
}

function mapServerTask(t: any): Task {
  return {
    id: t.id,
    visit_id: t.visitId || t.visit_id || '',
    equipment_type_id: t.equipmentTypeId || t.equipment_type_id || t.equipmentType?.id || '',
    equipment_type_name: t.equipmentType?.name || t.equipment_type_name || '',
    equipment_type_code: t.equipmentType?.code || t.equipment_type_code || '',
    room_type_id: t.roomTypeId || t.room_type_id || t.roomType?.id || '',
    room_type_name: t.roomType?.name || t.room_type_name || '',
    room_type_code: t.roomType?.code || t.roomTypeCode || t.room_type_code || '',
    object_equipment_id: t.objectEquipmentId || t.object_equipment_id || t.objectEquipment?.id || '',
    task_type: t.taskType || t.task_type || 'individual',
    status: t.status,
    parameters: t.parameters,
    conclusion: t.conclusion,
    additional_recommendations: t.additionalRecommendations || t.additional_recommendations,
    selected_recommendation_ids: t.selectedRecommendationIds || t.selected_recommendation_ids,
    photos_count: t._count?.photos ?? t.photos_count ?? t.photos?.length ?? 0,
    created_at: t.createdAt || t.created_at,
    updated_at: t.updatedAt || t.updated_at,
  };
}

function mapServerVisit(v: any): Visit {
  const requestNumber = v.importedRequests?.[0]?.externalRequestId
    || v.importedRequests?.[0]?.external_request_id
    || undefined;

  return {
    id: v.id,
    address_id: v.addressId || v.address?.id || '',
    address: typeof v.address === 'string' ? v.address : v.address?.fullAddress || '',
    date: v.dateStart || v.date || '',
    time_start: v.timeStart || v.time_start || '',
    season: v.season || getSeason(v.dateStart || v.date || ''),
    status: v.status,
    engineer_id: v.userId || v.engineer_id || '',
    engineer_name: v.user?.fullName || v.engineer_name || '',
    contract_number: v.contract?.number || undefined,
    request_number: requestNumber,
    tasks_count: v._count?.tasks ?? v.tasks_count ?? v.tasks?.length ?? 0,
    completed_tasks_count: v.completed_tasks_count ?? v.tasks?.filter((t: any) => t.status === 'completed')?.length ?? 0,
    tasks: v.tasks ? v.tasks.map(mapServerTask) : undefined,
    created_at: v.createdAt || v.created_at,
    updated_at: v.updatedAt || v.updated_at,
  };
}

export function useVisits(tab?: 'active' | 'completed') {
  return useQuery({
    queryKey: ['visits', tab],
    queryFn: async () => {
      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

      if (!isOnline) {
        return await getLocalVisits();
      }

      try {
        let statuses: string | undefined;
        if (tab === 'active') {
          statuses = 'not_started,in_progress,planned,awaiting_assignment';
        } else if (tab === 'completed') {
          statuses = 'completed,sent,sent_by_engineer,sent_by_tm,corrected_by_tm';
        }
        const params: any = { pageSize: 100 };
        if (statuses) params.statuses = statuses;
        const response = await api.get('/visits', { params });
        const raw = response.data.data || [];
        const serverVisits = raw.map(mapServerVisit) as Visit[];

        const localVisits = await getLocalVisits();
        const localIds = new Set(localVisits.map(v => v.id));
        const unsyncedLocal = localVisits.filter(v => localIds.has(v.id));

        const merged = [
          ...unsyncedLocal,
          ...serverVisits.filter(sv => !localIds.has(sv.id)),
        ];

        return merged;
      } catch {
        return await getLocalVisits();
      }
    },
    staleTime: 30 * 1000,
    refetchOnReconnect: 'always',
  });
}

export function useVisit(visitId: string) {
  return useQuery({
    queryKey: ['visit', visitId],
    queryFn: async () => {
      try {
        const response = await api.get(`/visits/${visitId}`);
        return mapServerVisit(response.data) as Visit;
      } catch {
        const local = await getLocalVisitWithTasks(visitId);
        if (local) return local;
        throw new Error('Визит не найден');
      }
    },
    enabled: !!visitId,
    refetchOnReconnect: 'always',
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  const addToQueue = useSyncStore((state) => state.addToQueue);

  return useMutation({
    mutationFn: async (data: Partial<Visit>) => {
      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

      const visitId = `local_${uuidv4()}`;

      if (!isOnline) {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO visits (id, address_id, address, date, time_start, season, status, engineer_name, latitude, longitude, gps_accuracy, dirty, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            visitId,
            data.address_id || '',
            data.address || '',
            data.date || '',
            data.time_start || '',
            data.season || 'summer',
            'not_started',
            data.engineer_name || '',
            data.latitude ?? null,
            data.longitude ?? null,
            data.gps_accuracy ?? null,
            new Date().toISOString(),
          ]
        );

        await addToQueue({
          client_mutation_id: uuidv4(),
          entity_type: 'visit',
          entity_id: visitId,
          action: 'create',
          payload: {
            id: visitId,
            addressId: data.address_id,
            address: data.address,
            dateStart: data.date,
            timeStart: data.time_start,
            season: data.season || 'summer',
            engineerName: data.engineer_name || '',
            latitude: data.latitude,
            longitude: data.longitude,
            gpsAccuracy: data.gps_accuracy,
          },
        });

        queryClient.invalidateQueries({ queryKey: ['visits'] });

        return {
          id: visitId,
          address_id: data.address_id || '',
          address: data.address || '',
          date: data.date || '',
          time_start: data.time_start || '',
          season: data.season || 'summer',
          status: 'not_started' as VisitStatus,
          engineer_name: data.engineer_name || '',
          latitude: data.latitude,
          longitude: data.longitude,
          gps_accuracy: data.gps_accuracy,
          tasks_count: 0,
          completed_tasks_count: 0,
          created_at: new Date().toISOString(),
        } as Visit;
      }

      const payload: Record<string, any> = {
        addressId: data.address_id,
        engineerName: data.engineer_name || '',
        dateStart: data.date,
        timeStart: data.time_start,
        season: data.season || 'summer',
      };
      if (data.latitude != null) payload.latitude = data.latitude;
      if (data.longitude != null) payload.longitude = data.longitude;
      if (data.gps_accuracy != null) payload.gpsAccuracy = data.gps_accuracy;
      const response = await api.post('/visits', payload);
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      return mapServerVisit(response.data) as Visit;
    },
  });
}

export function useUpdateVisitStatus() {
  const queryClient = useQueryClient();
  const addToQueue = useSyncStore((state) => state.addToQueue);

  return useMutation({
    mutationFn: async ({ visitId, status }: { visitId: string; status: VisitStatus }) => {
      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

      if (!isOnline) {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE visits SET status = ?, dirty = 1, updated_at = ? WHERE id = ?`,
          [status, new Date().toISOString(), visitId]
        );

        await addToQueue({
          client_mutation_id: uuidv4(),
          entity_type: 'visit',
          entity_id: visitId,
          action: 'update',
          payload: { status },
        });

        queryClient.invalidateQueries({ queryKey: ['visit', visitId] });
        queryClient.invalidateQueries({ queryKey: ['visits'] });
        return { id: visitId, status } as Visit;
      }

      const response = await api.put(`/visits/${visitId}`, { status });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit'] });
      return response.data as Visit;
    },
  });
}

export function useDeleteVisit() {
  const queryClient = useQueryClient();
  const addToQueue = useSyncStore((state) => state.addToQueue);

  return useMutation({
    mutationFn: async (visitId: string) => {
      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

      if (!isOnline) {
        const db = await getDatabase();
        await db.runAsync(`DELETE FROM visits WHERE id = ?`, [visitId]);
        await db.runAsync(`DELETE FROM tasks WHERE visit_id = ?`, [visitId]);

        await addToQueue({
          client_mutation_id: uuidv4(),
          entity_type: 'visit',
          entity_id: visitId,
          action: 'delete',
          payload: { id: visitId },
        });

        queryClient.invalidateQueries({ queryKey: ['visits'] });
        return;
      }

      await api.delete(`/visits/${visitId}`);
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
  });
}
