const API_BASE = '/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isOffline(): boolean {
  return !navigator.onLine;
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
  getObjectEquipment: (addressId: string, params?: { exclude_visit_id?: string; specialization?: string }) => {
    const entries: Record<string, string> = { address_id: addressId };
    if (params?.exclude_visit_id) entries.exclude_visit_id = params.exclude_visit_id;
    if (params?.specialization) entries.specialization = params.specialization;
    const qs = new URLSearchParams(entries).toString();
    return request<any[]>(`/refs/object-equipment?${qs}`);
  },

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
  reassignVisit: (id: string, newUserId: string) =>
    request<any>(`/visits/${id}/reassign`, { method: 'POST', body: JSON.stringify({ newUserId }) }),

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
  getPhotoBlobUrl: async (photoId: string): Promise<string> => {
    const blob = await api.downloadFile(`${API_BASE}/photos/${photoId}/file`);
    return URL.createObjectURL(blob);
  },

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

  // Summary & Object reports
  downloadSummaryReport: async (params: { period: string; date?: string; engineerId?: string; addressId?: string }): Promise<void> => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][]
    ).toString();
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/reports/summary?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary_${params.period}_${params.date || 'report'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  downloadObjectReport: async (params: { addressId: string; dateFrom?: string; dateTo?: string }): Promise<void> => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][]
    ).toString();
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/reports/by-object?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `object_${params.addressId}_report.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

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

  exportAuditLog: async (params: Record<string, string>) => {
    const token = localStorage.getItem('accessToken');
    const qs = '?' + new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/admin/audit-log/export${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Ошибка выгрузки');
    return res.blob();
  },

  clearAuditLog: (params: Record<string, string>) => {
    const qs = '?' + new URLSearchParams(params).toString();
    return request<any>(`/admin/audit-log${qs}`, { method: 'DELETE' });
  },

  // Proposals
  createProposal: (data: any) =>
    request<any>('/proposals', { method: 'POST', body: JSON.stringify(data) }),
  getProposals: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/proposals/admin${qs}`);
  },
  approveProposal: (id: string) =>
    request<any>(`/proposals/admin/${id}/approve`, { method: 'PUT' }),
  rejectProposal: (id: string) =>
    request<any>(`/proposals/admin/${id}/reject`, { method: 'PUT' }),

  // Object equipment room confirmation
  confirmEquipmentRoom: (id: string, roomTypeCode: string) =>
    request<any>(`/refs/object-equipment/${id}/room`, { method: 'PATCH', body: JSON.stringify({ roomTypeCode }) }),

  // Profile
  getProfile: () => request<any>('/profile'),
  updateSpecialization: (data: { specializationVik: boolean; specializationIszh: boolean }) =>
    request<any>('/profile/specialization', { method: 'PATCH', body: JSON.stringify(data) }),
  getFavorites: () => request<any[]>('/profile/favorites'),
  addFavorite: (objectCode: string) =>
    request<any>('/profile/favorites', { method: 'POST', body: JSON.stringify({ objectCode }) }),
  removeFavorite: (objectCode: string) =>
    request<any>(`/profile/favorites/${objectCode}`, { method: 'DELETE' }),
  getProfileStats: () => request<any>('/profile/stats'),

  // ─── OFFLINE-AWARE METHODS ────────────────────────────────────
  // These methods work both online and offline.
  // When offline, data is saved to IndexedDB and queued for sync.

  createVisitOffline: async (data: any) => {
    if (!isOffline()) return api.createVisit(data);
    const { db, localId, enqueueSync } = await import('../db/index');
    const id = localId();
    const now = new Date().toISOString();
    const userId = JSON.parse(atob(localStorage.getItem('accessToken')!.split('.')[1])).userId;
    await db.visits.add({
      id, userId, addressId: data.addressId, engineerName: data.engineerName,
      dateStart: data.dateStart, timeStart: data.timeStart, season: data.season,
      status: 'in_progress', isDeleted: false, createdAt: now, updatedAt: now, dirty: true,
    });
    await enqueueSync({ operation: 'create', entityType: 'visit', entityId: id });
    return { id, ...data, status: 'in_progress', _offline: true };
  },

  createTaskOffline: async (visitId: string, data: any) => {
    if (!isOffline()) return api.createTask(visitId, data);
    const { db, localId, enqueueSync } = await import('../db/index');
    const id = localId();
    const now = new Date().toISOString();
    const visit = await db.visits.get(visitId);
    await db.tasks.add({
      id, visitLocalId: visitId, visitServerId: visit?.serverId,
      equipmentTypeId: data.equipmentTypeId, roomTypeId: data.roomTypeId,
      objectEquipmentId: data.objectEquipmentId,
      comment: data.comment, brand: data.brand, model: data.model, serialNumber: data.serialNumber, sortOrder: data.sortOrder || 0,
      status: 'not_started', selectedRecommendationIds: [],
      createdAt: now, updatedAt: now, dirty: true,
    });
    await enqueueSync({ operation: 'create', entityType: 'task', entityId: id });
    return { id, visitId, ...data, status: 'not_started', _offline: true };
  },

  updateTaskOffline: async (visitId: string, taskId: string, data: any) => {
    if (!isOffline()) return api.updateTask(visitId, taskId, data);
    const { db, enqueueSync } = await import('../db/index');
    const task = await db.tasks.get(taskId);
    if (task) {
      await db.tasks.update(taskId, { ...data, dirty: true, updatedAt: new Date().toISOString() });
      await enqueueSync({ operation: 'update', entityType: 'task', entityId: taskId });
    }
    return { id: taskId, ...data, _offline: true };
  },

  uploadPhotoOffline: async (taskId: string, file: File, moment: 'before' | 'after') => {
    if (!isOffline()) return api.uploadPhoto(taskId, file, moment);
    const { db, localId, enqueueSync } = await import('../db/index');
    const id = localId();
    const task = await db.tasks.get(taskId);
    await db.photos.add({
      id, taskLocalId: taskId, taskServerId: task?.serverId,
      blob: file, fileName: file.name, moment,
      fileSize: file.size, mimeType: file.type,
      createdAt: new Date().toISOString(), dirty: true,
    });
    await enqueueSync({ operation: 'upload_photo', entityType: 'photo', entityId: id });
    return { id, taskId, moment, fileName: file.name, _offline: true };
  },

  completeVisitOffline: async (visitId: string) => {
    if (!isOffline()) return api.completeVisit(visitId);
    const { db, enqueueSync } = await import('../db/index');
    await db.visits.update(visitId, { status: 'completed', dirty: true, updatedAt: new Date().toISOString() });
    await enqueueSync({ operation: 'complete', entityType: 'visit', entityId: visitId });
    return { id: visitId, status: 'completed', _offline: true };
  },

  deleteVisitOffline: async (visitId: string) => {
    if (!isOffline()) return api.deleteVisit(visitId);
    const { db, enqueueSync } = await import('../db/index');
    await db.visits.update(visitId, { isDeleted: true, dirty: true });
    await enqueueSync({ operation: 'delete', entityType: 'visit', entityId: visitId });
    return { message: 'Визит помечен на удаление', _offline: true };
  },

  // Get local visits (merge of server-synced and local-only)
  getLocalVisits: async () => {
    const { db } = await import('../db/index');
    return db.visits.where('isDeleted').equals(0).reverse().sortBy('dateStart');
  },

  getLocalTasks: async (visitLocalId: string) => {
    const { db } = await import('../db/index');
    return db.tasks.where('visitLocalId').equals(visitLocalId).toArray();
  },

  getLocalPhotos: async (taskLocalId: string) => {
    const { db } = await import('../db/index');
    return db.photos.where('taskLocalId').equals(taskLocalId).toArray();
  },

  getLocalPhotoUrl: async (photoLocalId: string): Promise<string> => {
    const { db } = await import('../db/index');
    const photo = await db.photos.get(photoLocalId);
    if (!photo) throw new Error('Photo not found');
    return URL.createObjectURL(photo.blob);
  },

  // ─── FAVORITES OFFLINE-AWARE ──────────────────────────────────
  addFavoriteOffline: async (objectCode: string) => {
    if (!isOffline()) return api.addFavorite(objectCode);
    const { db, localId, enqueueSync } = await import('../db/index');
    const id = localId();
    const token = localStorage.getItem('accessToken');
    const userId = token ? JSON.parse(atob(token.split('.')[1])).userId : 'unknown';
    await db.favorites.add({
      id,
      userId,
      objectCode,
      addedAt: new Date().toISOString(),
      dirty: true,
    });
    await enqueueSync({ operation: 'create', entityType: 'favorite' as any, entityId: id });
    return { id, objectCode, _offline: true };
  },

  getLocalFavorites: async () => {
    const { db } = await import('../db/index');
    return db.favorites.toArray();
  },
};
