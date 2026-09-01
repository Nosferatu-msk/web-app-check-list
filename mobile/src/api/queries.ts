import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import { Visit, VisitStatus, Task } from '../types';

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
      return raw.map(mapServerVisit) as Visit[];
    },
    staleTime: 30 * 1000,
  });
}

export function useVisit(visitId: string) {
  return useQuery({
    queryKey: ['visit', visitId],
    queryFn: async () => {
      const response = await api.get(`/visits/${visitId}`);
      return mapServerVisit(response.data) as Visit;
    },
    enabled: !!visitId,
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Visit>) => {
      const payload = {
        addressId: data.address_id,
        engineerName: data.engineer_name || '',
        dateStart: data.date,
        timeStart: data.time_start,
        season: data.season || 'summer',
      };
      const response = await api.post('/visits', payload);
      return mapServerVisit(response.data) as Visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
  });
}

export function useUpdateVisitStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ visitId, status }: { visitId: string; status: VisitStatus }) => {
      const response = await api.put(`/visits/${visitId}`, { status });
      return response.data as Visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit'] });
    },
  });
}
