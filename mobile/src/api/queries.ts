import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import { Visit, VisitStatus } from '../types';

function getSeason(dateStr: string): 'summer' | 'winter' {
  const month = new Date(dateStr).getMonth() + 1;
  return month >= 4 && month <= 10 ? 'summer' : 'winter';
}

function mapServerVisit(v: any): Visit {
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
    tasks_count: v._count?.tasks ?? v.tasks_count ?? 0,
    completed_tasks_count: v.completed_tasks_count ?? 0,
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
      const response = await api.post('/visits', data);
      return response.data as Visit;
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
