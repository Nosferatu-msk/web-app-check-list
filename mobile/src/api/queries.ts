import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import { Visit, VisitStatus } from '../types';

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
      // Сервер возвращает { data: Visit[], total, page, pageSize, globalStats }
      return response.data.data as Visit[];
    },
    staleTime: 30 * 1000,
  });
}

export function useVisit(visitId: string) {
  return useQuery({
    queryKey: ['visit', visitId],
    queryFn: async () => {
      const response = await api.get(`/visits/${visitId}`);
      return response.data as Visit;
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
