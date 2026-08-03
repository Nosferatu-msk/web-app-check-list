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
  getEngineers: () => request<any[]>('/refs/engineers'),
  getRecommendations: (equipmentTypeId: string) =>
    request<any[]>(`/refs/recommendations?equipment_type_id=${equipmentTypeId}`),
  searchAddresses: (q: string) => request<any[]>(`/refs/addresses/search?q=${encodeURIComponent(q)}`),
  getObjectEquipment: (addressId: string, params?: { exclude_visit_id?: string; specialization?: string; binding_level?: string; room_type_code?: string; is_outdoor_unit?: string }) => {
    const entries: Record<string, string> = { address_id: addressId, _t: String(Date.now()) };
    if (params?.exclude_visit_id) entries.exclude_visit_id = params.exclude_visit_id;
    if (params?.specialization) entries.specialization = params.specialization;
    if (params?.binding_level) entries.binding_level = params.binding_level;
    if (params?.room_type_code) entries.room_type_code = params.room_type_code;
    if (params?.is_outdoor_unit !== undefined) entries.is_outdoor_unit = params.is_outdoor_unit;
    const qs = new URLSearchParams(entries).toString();
    return request<any[]>(`/refs/object-equipment?${qs}`);
  },
  getEquipmentRooms: (addressId: string, params?: { exclude_visit_id?: string }) => {
    const entries: Record<string, string> = { address_id: addressId, _t: String(Date.now()) };
    if (params?.exclude_visit_id) entries.exclude_visit_id = params.exclude_visit_id;
    const qs = new URLSearchParams(entries).toString();
    return request<any[]>(`/refs/object-equipment/rooms?${qs}`);
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

  // Task Equipment Items (групповые задачи)
  addTaskItem: (visitId: string, taskId: string, objectEquipmentId: string) =>
    request<any>(`/visits/${visitId}/tasks/${taskId}/items`, {
      method: 'POST', body: JSON.stringify({ objectEquipmentId }),
    }),
  updateTaskItem: (visitId: string, taskId: string, itemId: string, data: any) =>
    request<any>(`/visits/${visitId}/tasks/${taskId}/items/${itemId}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  deleteTaskItem: (visitId: string, taskId: string, itemId: string) =>
    request<any>(`/visits/${visitId}/tasks/${taskId}/items/${itemId}`, { method: 'DELETE' }),

  // Photos
  uploadPhoto: (taskId: string, file: File, moment: 'before' | 'after') => {
    const form = new FormData();
    form.append('photo', file);
    form.append('moment', moment);
    return request<any>(`/tasks/${taskId}/photos`, { method: 'POST', body: form });
  },
  uploadItemPhoto: (itemId: string, file: File, moment: 'before' | 'after') => {
    const form = new FormData();
    form.append('photo', file);
    form.append('moment', moment);
    return request<any>(`/tasks/items/${itemId}/photos`, { method: 'POST', body: form });
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

  // Unified summary report
  generateUnifiedReport: async (data: {
    type: 'period' | 'objects' | 'requests';
    dateFrom: string;
    dateTo: string;
    addressIds?: string[];
    requestIds?: string[];
    engineerId?: string;
    scanIds?: string[];
  }): Promise<void> => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/reports/summary-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    const fileName = match ? decodeURIComponent(match[1]) : (data.type === 'period' ? 'svodnyj_otchet.pdf' : data.type === 'requests' ? 'otchet_po_zayavkam.pdf' : 'otchet_po_obektam.pdf');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  uploadActScans: async (files: File[]): Promise<{ scanIds: string[] }> => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/reports/upload-act-scans`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    return res.json();
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
  createRoomChangeProposal: (data: { objectEquipmentId: string; newRoomTypeCode: string }) =>
    request<any>('/proposals/room-change', { method: 'POST', body: JSON.stringify(data) }),
  getMyProposals: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/proposals/my${qs}`);
  },
  getProposals: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/proposals/admin${qs}`);
  },
  updateProposal: (id: string, data: any) =>
    request<any>(`/proposals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancelProposal: (id: string) =>
    request<any>(`/proposals/${id}`, { method: 'DELETE' }),
  approveProposal: (id: string) =>
    request<any>(`/proposals/admin/${id}/approve`, { method: 'PUT' }),
  rejectProposal: (id: string, reason?: string) =>
    request<any>(`/proposals/admin/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  batchProposals: (data: { ids: string[]; action: 'approve' | 'reject'; reason?: string }) =>
    request<any>('/proposals/admin/batch', { method: 'PUT', body: JSON.stringify(data) }),

  // Object equipment
  getOtherRoomsEquipment: (params: { address_id: string; current_room_type_code: string; exclude_visit_id?: string }) => {
    const qs = '?' + new URLSearchParams(params as Record<string, string>).toString();
    return request<any>(`/refs/object-equipment/other-rooms${qs}`);
  },

  // Notifications
  getNotifications: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/notifications${qs}`);
  },
  markNotificationRead: (id: string) =>
    request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request<any>('/notifications/read-all', { method: 'PATCH' }),
  clearAllNotifications: () =>
    request<any>('/notifications/clear-all', { method: 'POST' }),

  // Admin: system notifications
  getSystemReleases: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/admin/system-releases${qs}`);
  },
  createSystemNotification: (data: { title: string; message: string; version?: string }) =>
    request<any>('/admin/system-notifications', { method: 'POST', body: JSON.stringify(data) }),

  // Object equipment room confirmation
  confirmEquipmentRoom: (id: string, roomTypeCode: string) =>
    request<any>(`/refs/object-equipment/${id}/room`, { method: 'PATCH', body: JSON.stringify({ roomTypeCode }) }),

  // Profile
  getProfile: () => request<any>('/profile'),
  updateSpecialization: (data: { specializationVik: boolean; specializationIszh: boolean; specializationGpm: boolean; specializationDgu: boolean; specializationIbp: boolean }) =>
    request<any>('/profile/specialization', { method: 'PATCH', body: JSON.stringify(data) }),
  getFavorites: () => request<any[]>('/profile/favorites'),
  addFavorite: (addressIdOrCode: string) =>
    request<any>('/profile/favorites', { method: 'POST', body: JSON.stringify(addressIdOrCode.includes('/') ? { objectCode: addressIdOrCode } : { addressId: addressIdOrCode }) }),
  removeFavorite: (objectCode: string) =>
    request<any>(`/profile/favorites/${objectCode}`, { method: 'DELETE' }),
  getProfileStats: () => request<any>('/profile/stats'),
  getTmObjects: () => request<any[]>('/profile/objects'),
  createEngineer: (data: { fullName: string; email: string; specializationVik?: boolean; specializationIszh?: boolean; specializationGpm?: boolean; specializationDgu?: boolean; specializationIbp?: boolean }) =>
    request<any>('/profile/engineers', { method: 'POST', body: JSON.stringify(data) }),

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
      taskType: data.taskType || 'individual',
      equipmentTypeId: data.equipmentTypeId, roomTypeId: data.roomTypeId,
      roomTypeCode: data.roomTypeCode,
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

  // ─── MTR OFFLINE-AWARE METHODS ───────────────────────────────
  mtrCreateVisitOffline: async (data: { addressId: string; requestNumber: string; dateStart: string; timeStart: string }) => {
    if (!isOffline()) return api.mtr.createVisit(data);
    const { db, localId, enqueueSync } = await import('../db/index');
    const id = localId();
    const now = new Date().toISOString();
    const token = localStorage.getItem('accessToken');
    const engineerId = token ? JSON.parse(atob(token.split('.')[1])).userId : 'unknown';
    await db.mtrVisits.add({
      id,
      engineerId,
      addressId: data.addressId,
      requestNumber: data.requestNumber,
      dateStart: data.dateStart,
      timeStart: data.timeStart,
      status: 'draft',
      isDraft: true,
      createdAt: now,
      updatedAt: now,
      dirty: true,
    });
    await enqueueSync({ operation: 'create', entityType: 'mtr_visit', entityId: id });
    return { id, ...data, status: 'draft', _offline: true };
  },

  mtrAddWorkOffline: async (visitId: string, data: { mtrWorkTypeId: string; quantity?: number; comment?: string }) => {
    if (!isOffline()) return api.mtr.addWork(visitId, data);
    const { db, localId, enqueueSync } = await import('../db/index');
    const id = localId();
    const visit = await db.mtrVisits.get(visitId);
    const works = await db.mtrVisitWorks.where('mtrVisitLocalId').equals(visitId).toArray();
    const maxOrder = works.reduce((max, w) => Math.max(max, w.sortOrder), 0);
    await db.mtrVisitWorks.add({
      id,
      mtrVisitLocalId: visitId,
      mtrVisitServerId: visit?.serverId,
      mtrWorkTypeId: data.mtrWorkTypeId,
      quantity: data.quantity ?? 1,
      comment: data.comment,
      sortOrder: maxOrder + 1,
      createdAt: new Date().toISOString(),
      dirty: true,
    });
    await enqueueSync({ operation: 'create', entityType: 'mtr_work', entityId: id });
    // If visit was draft, move to in_progress
    if (visit && visit.status === 'draft') {
      await db.mtrVisits.update(visitId, { status: 'in_progress', dirty: true });
    }
    return { id, ...data, _offline: true };
  },

  mtrRemoveWorkOffline: async (visitId: string, workId: string) => {
    if (!isOffline()) return api.mtr.removeWork(visitId, workId);
    const { db, enqueueSync } = await import('../db/index');
    await db.mtrVisitWorks.delete(workId);
    await enqueueSync({ operation: 'delete', entityType: 'mtr_work', entityId: workId, payload: { visitId } });
    return { message: 'Работа удалена', _offline: true };
  },

  mtrUploadPhotoOffline: async (visitId: string, file: File, moment: 'before' | 'after') => {
    if (!isOffline()) return api.mtr.uploadMtrPhoto(visitId, (() => { const fd = new FormData(); fd.append('photo', file); fd.append('moment', moment); return fd; })());
    const { db, localId, enqueueSync } = await import('../db/index');
    const id = localId();
    const visit = await db.mtrVisits.get(visitId);
    await db.mtrPhotos.add({
      id,
      mtrVisitLocalId: visitId,
      mtrVisitServerId: visit?.serverId,
      blob: file,
      fileName: file.name,
      moment,
      fileSize: file.size,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
      dirty: true,
    });
    await enqueueSync({ operation: 'upload_photo', entityType: 'mtr_photo', entityId: id });
    return { id, visitId, moment, fileName: file.name, _offline: true };
  },

  mtrCompleteVisitOffline: async (visitId: string) => {
    if (!isOffline()) return api.mtr.completeVisit(visitId);
    const { db, enqueueSync } = await import('../db/index');
    await db.mtrVisits.update(visitId, { status: 'sent', dirty: true, updatedAt: new Date().toISOString() });
    await enqueueSync({ operation: 'complete', entityType: 'mtr_visit', entityId: visitId });
    return { id: visitId, status: 'sent', _offline: true };
  },

  mtrDeleteVisitOffline: async (visitId: string) => {
    if (!isOffline()) return api.mtr.deleteVisit(visitId);
    const { db, enqueueSync } = await import('../db/index');
    await db.mtrVisits.delete(visitId);
    await enqueueSync({ operation: 'delete', entityType: 'mtr_visit', entityId: visitId });
    return { message: 'Визит удалён', _offline: true };
  },

  getLocalMtrVisits: async () => {
    const { db } = await import('../db/index');
    return db.mtrVisits.reverse().sortBy('dateStart');
  },

  getLocalMtrVisitWorks: async (visitLocalId: string) => {
    const { db } = await import('../db/index');
    return db.mtrVisitWorks.where('mtrVisitLocalId').equals(visitLocalId).sortBy('sortOrder');
  },

  getLocalMtrPhotos: async (visitLocalId: string) => {
    const { db } = await import('../db/index');
    return db.mtrPhotos.where('mtrVisitLocalId').equals(visitLocalId).toArray();
  },

  getLocalMtrPhotoUrl: async (photoId: string): Promise<string> => {
    const { db } = await import('../db/index');
    const photo = await db.mtrPhotos.get(photoId);
    if (!photo) throw new Error('MTR photo not found');
    return URL.createObjectURL(photo.blob);
  },

  // ─── MANUFACTURERS ──────────────────────────────────────────
  getManufacturers: async (params?: { page?: number; pageSize?: number; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.q) qs.set('q', params.q);
    return request<{ data: any[]; total: number; page: number; pageSize: number }>(`/admin/manufacturers?${qs}`);
  },

  createManufacturer: (data: { name: string; country?: string }) =>
    request('/admin/manufacturers', { method: 'POST', body: JSON.stringify(data) }),

  updateManufacturer: (id: string, data: { name?: string; country?: string; isActive?: boolean }) =>
    request(`/admin/manufacturers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteManufacturer: (id: string) =>
    request(`/admin/manufacturers/${id}`, { method: 'DELETE' }),

  // ─── MODELS ─────────────────────────────────────────────────
  getModels: async (params?: { page?: number; pageSize?: number; q?: string; status?: string; equipment_type_id?: string; manufacturer_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
    if (params?.equipment_type_id) qs.set('equipment_type_id', params.equipment_type_id);
    if (params?.manufacturer_id) qs.set('manufacturer_id', params.manufacturer_id);
    return request<{ data: any[]; total: number; page: number; pageSize: number }>(`/admin/models?${qs}`);
  },

  createModel: (data: { equipmentTypeId: string; manufacturerId: string; modelName: string; fullModelName?: string }) =>
    request('/admin/models', { method: 'POST', body: JSON.stringify(data) }),

  updateModel: (id: string, data: { equipmentTypeId?: string; manufacturerId?: string; modelName?: string; fullModelName?: string }) =>
    request(`/admin/models/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  approveModel: (id: string) =>
    request(`/admin/models/${id}/approve`, { method: 'PUT' }),

  rejectModel: (id: string, reason?: string) =>
    request(`/admin/models/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),

  searchModels: async (params: { equipment_type_id?: string; query?: string }) => {
    const qs = new URLSearchParams();
    if (params.equipment_type_id) qs.set('equipment_type_id', params.equipment_type_id);
    if (params.query) qs.set('query', params.query);
    return request<any[]>(`/refs/models/search?${qs}`);
  },

  getManufacturersList: async () =>
    request<any[]>('/refs/manufacturers'),

  // ─── ЗАЯВКИ (REQUESTS) ───────────────────────────────────────
  importRequests: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<any>('/requests/import', { method: 'POST', body: formData });
  },

  validateRequestsFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<any>('/requests/import?mode=validate', { method: 'POST', body: formData });
  },

  getImportStatus: async (id: string) =>
    request<any>(`/requests/import/${id}`),

  getRequests: async (params?: {
    page?: number; pageSize?: number;
    importStatus?: string; executionStatus?: string;
    objectCode?: string; sortField?: string; sortOrder?: string;
    engineerId?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.importStatus) qs.set('importStatus', params.importStatus);
    if (params?.executionStatus) qs.set('executionStatus', params.executionStatus);
    if (params?.objectCode) qs.set('objectCode', params.objectCode);
    if (params?.sortField) qs.set('sortField', params.sortField);
    if (params?.sortOrder) qs.set('sortOrder', params.sortOrder);
    if (params?.engineerId) qs.set('engineerId', params.engineerId);
    return request<any>(`/requests?${qs}`);
  },

  getRequest: async (id: string) =>
    request<any>(`/requests/${id}`),

  bindRequest: async (id: string, addressId: string) =>
    request<any>(`/requests/${id}/bind`, { method: 'POST', body: JSON.stringify({ addressId }) }),

  assignEngineer: async (requestId: string, engineerId: string) =>
    request<any>('/requests/assign', { method: 'POST', body: JSON.stringify({ requestId, engineerId }) }),

  unassignEngineer: async (visitId: string, engineerId: string, requestId?: string, reason?: string) =>
    request<any>('/requests/unassign', { method: 'POST', body: JSON.stringify({ visitId, engineerId, requestId, reason }) }),

  declineRequest: async (requestId: string, reason: string) =>
    request<any>('/requests/decline', { method: 'POST', body: JSON.stringify({ requestId, reason }) }),

  searchRequestsByNumbers: async (externalRequestIds: string[]) =>
    request<any[]>('/requests/search-by-numbers', { method: 'POST', body: JSON.stringify({ externalRequestIds }) }),

  // ─── MTR (Мелкий текущий ремонт) ───────────────────────────
  mtr: {
    // Engineer
    getVisits: (params?: { status?: string; page?: number; pageSize?: number; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.page) qs.set('page', String(params.page));
      if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
      if (params?.search) qs.set('search', params.search);
      const query = qs.toString();
      return request<any>(`/mtr/visits${query ? '?' + query : ''}`);
    },
    createVisit: (data: { addressId: string; requestNumber: string; dateStart: string; timeStart: string }) =>
      request<any>('/mtr/visits', { method: 'POST', body: JSON.stringify(data) }),
    getVisit: (id: string) => request<any>(`/mtr/visits/${id}`),
    updateVisit: (id: string, data: any) =>
      request<any>(`/mtr/visits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteVisit: (id: string) =>
      request<any>(`/mtr/visits/${id}`, { method: 'DELETE' }),
    addWork: (visitId: string, data: { mtrWorkTypeId: string; quantity?: number; comment?: string }) =>
      request<any>(`/mtr/visits/${visitId}/works`, { method: 'POST', body: JSON.stringify(data) }),
    removeWork: (visitId: string, workId: string) =>
      request<any>(`/mtr/visits/${visitId}/works/${workId}`, { method: 'DELETE' }),
    completeVisit: (id: string) =>
      request<any>(`/mtr/visits/${id}/complete`, { method: 'PUT' }),
    saveDraft: (id: string) =>
      request<any>(`/mtr/visits/${id}/save-draft`, { method: 'PUT' }),

    // Photos
    uploadMtrPhoto: (visitId: string, formData: FormData) =>
      request<any>(`/photos/mtr-visits/${visitId}/photos`, { method: 'POST', body: formData }),
    getMtrPhotos: (visitId: string) => request<any[]>(`/photos/mtr-visits/${visitId}/photos`),
    deleteMtrPhoto: (visitId: string, photoId: string) =>
      request<any>(`/photos/mtr-visits/${visitId}/photos/${photoId}`, { method: 'DELETE' }),

    // Work types search
    searchWorkTypes: (q: string) => request<any[]>(`/mtr/work-types/search?q=${encodeURIComponent(q)}`),
    getAllWorkTypes: () => request<any[]>('/mtr/work-types/all'),

    // TM
    getTmVisits: (params?: { status?: string; engineer_id?: string; page?: number; pageSize?: number; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.engineer_id) qs.set('engineer_id', params.engineer_id);
      if (params?.page) qs.set('page', String(params.page));
      if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
      if (params?.search) qs.set('search', params.search);
      const query = qs.toString();
      return request<any>(`/mtr/tm/visits${query ? '?' + query : ''}`);
    },
    acceptVisit: (id: string) =>
      request<any>(`/mtr/tm/visits/${id}/accept`, { method: 'PUT' }),
    rejectVisit: (id: string, reason: string) =>
      request<any>(`/mtr/tm/visits/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
    getTmEngineers: () => request<any[]>('/mtr/tm/engineers'),

    // Admin
    getWorkTypes: (params?: { search?: string; is_active?: boolean; page?: number; pageSize?: number }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set('search', params.search);
      if (params?.is_active !== undefined) qs.set('is_active', String(params.is_active));
      if (params?.page) qs.set('page', String(params.page));
      if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
      const query = qs.toString();
      return request<any>(`/mtr/admin/work-types${query ? '?' + query : ''}`);
    },
    createWorkType: (data: { name: string; category?: string; isActive?: boolean }) =>
      request<any>('/mtr/admin/work-types', { method: 'POST', body: JSON.stringify(data) }),
    updateWorkType: (id: string, data: any) =>
      request<any>(`/mtr/admin/work-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteWorkType: (id: string) =>
      request<any>(`/mtr/admin/work-types/${id}`, { method: 'DELETE' }),
    getTmObjects: (params?: { tm_id?: string }) => {
      const qs = new URLSearchParams();
      if (params?.tm_id) qs.set('tm_id', params.tm_id);
      const query = qs.toString();
      return request<any>(`/mtr/admin/tm-objects${query ? '?' + query : ''}`);
    },
    createTmObject: (data: { tmId: string; addressId: string }) =>
      request<any>('/mtr/admin/tm-objects', { method: 'POST', body: JSON.stringify(data) }),
    deleteTmObject: (id: string) =>
      request<any>(`/mtr/admin/tm-objects/${id}`, { method: 'DELETE' }),
    getTmEngineersAdmin: (params?: { tm_id?: string }) => {
      const qs = new URLSearchParams();
      if (params?.tm_id) qs.set('tm_id', params.tm_id);
      const query = qs.toString();
      return request<any>(`/mtr/admin/tm-engineers${query ? '?' + query : ''}`);
    },
    createTmEngineer: (data: { tmId: string; engineerId: string }) =>
      request<any>('/mtr/admin/tm-engineers', { method: 'POST', body: JSON.stringify(data) }),
    deleteTmEngineer: (id: string) =>
      request<any>(`/mtr/admin/tm-engineers/${id}`, { method: 'DELETE' }),
  },
};
