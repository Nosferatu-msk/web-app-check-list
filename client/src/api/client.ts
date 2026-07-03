const API_BASE = '/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401 && token) {
    // Try refresh
    const refresh = localStorage.getItem('refreshToken');
    if (refresh) {
      const r = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (r.ok) {
        const data = await r.json();
        localStorage.setItem('accessToken', data.accessToken);
        headers['Authorization'] = `Bearer ${data.accessToken}`;
        const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (retry.ok) return retry.json();
      }
    }
    localStorage.clear();
    window.location.href = '/login';
    throw new ApiError('Сессия истекла', 401);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || res.statusText, res.status);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<any>('/auth/me'),
  forgotPassword: (email: string) =>
    request<any>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request<any>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // Refs
  getEquipmentTypes: () => request<any[]>('/refs/equipment-types'),
  getRoomTypes: () => request<any[]>('/refs/room-types'),
  getRecommendations: (equipmentTypeId: string) =>
    request<any[]>(`/refs/recommendations?equipment_type_id=${equipmentTypeId}`),
  searchAddresses: (q: string) => request<any[]>(`/refs/addresses/search?q=${encodeURIComponent(q)}`),

  // Visits
  createVisit: (data: any) =>
    request<any>('/visits', { method: 'POST', body: JSON.stringify(data) }),
  getVisits: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/visits${qs}`);
  },
  getVisit: (id: string) => request<any>(`/visits/${id}`),
  updateVisit: (id: string, data: any) =>
    request<any>(`/visits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVisit: (id: string) =>
    request<any>(`/visits/${id}`, { method: 'DELETE' }),
  completeVisit: (id: string) =>
    request<any>(`/visits/${id}/complete`, { method: 'POST' }),

  // Tasks
  createTask: (visitId: string, data: any) =>
    request<any>(`/visits/${visitId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  getTasks: (visitId: string) => request<any[]>(`/visits/${visitId}/tasks`),
  getTask: (visitId: string, taskId: string) => request<any>(`/visits/${visitId}/tasks/${taskId}`),
  updateTask: (visitId: string, taskId: string, data: any) =>
    request<any>(`/visits/${visitId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (visitId: string, taskId: string) =>
    request<any>(`/visits/${visitId}/tasks/${taskId}`, { method: 'DELETE' }),
  resetTask: (visitId: string, taskId: string) =>
    request<any>(`/visits/${visitId}/tasks/${taskId}/reset`, { method: 'POST' }),

  // Photos
  uploadPhoto: (taskId: string, file: File, moment: 'before' | 'after') => {
    const form = new FormData();
    form.append('photo', file);
    form.append('moment', moment);
    return request<any>(`/tasks/${taskId}/photos`, { method: 'POST', body: form });
  },
  getPhotos: (taskId: string) => request<any[]>(`/tasks/${taskId}/photos`),
  deletePhoto: (photoId: string) => request<any>(`/photos/${photoId}`, { method: 'DELETE' }),
  getPhotoUrl: (photoId: string) => `${API_BASE}/photos/${photoId}/file`,

  // Reports
  generateReport: (visitId: string) =>
    request<any>(`/reports/${visitId}/report/generate`, { method: 'POST' }),
  downloadReport: (visitId: string) => `${API_BASE}/reports/${visitId}/report/download`,
  downloadFile: async (url: string): Promise<Blob> => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return res.blob();
  },
  sendReport: (visitId: string, data: { email: string; cc?: string; comment?: string }) =>
    request<any>(`/reports/${visitId}/report/send`, { method: 'POST', body: JSON.stringify(data) }),

  // Admin
  adminGet: (entity: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/admin/${entity}${qs}`);
  },
  adminCreate: (entity: string, data: any) =>
    request<any>(`/admin/${entity}`, { method: 'POST', body: JSON.stringify(data) }),
  adminUpdate: (entity: string, id: string, data: any) =>
    request<any>(`/admin/${entity}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminDelete: (entity: string, id: string) =>
    request<any>(`/admin/${entity}/${id}`, { method: 'DELETE' }),
};
