import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import { Visit, VisitStatus } from '../types';

export function useVisits(status?: 'active' | 'completed') {
  return useQuery({
    queryKey: ['visits', status],
    queryFn: async () => {
      const params = status ? { status } : {};
      const response = await api.get('/visits', { params });
      return response.data as Visit[];
    },
    staleTime: 30 * 1000, // 30 секунд
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
