import { db, type SyncQueueItem, type LocalVisit, type LocalTask, type LocalPhoto, type LocalFavorite } from './index';
import { useAuthStore } from '../store/authStore';

type SyncStatus = 'idle' | 'syncing' | 'error';
type SyncCallback = (status: SyncStatus, pending: number, error?: string) => void;

let syncCallbacks: SyncCallback[] = [];
let isSyncing = false;

export function onSyncStatusChange(cb: SyncCallback) {
  syncCallbacks.push(cb);
  return () => { syncCallbacks = syncCallbacks.filter(c => c !== cb); };
}

function notify(status: SyncStatus, pending: number, error?: string) {
  syncCallbacks.forEach(cb => cb(status, pending, error));
}

// ─── SYNC QUEUE PROCESSING ───────────────────────────────────
export async function processSyncQueue(): Promise<{ success: number; failed: number }> {
  if (isSyncing) return { success: 0, failed: 0 };
  isSyncing = true;

  const token = localStorage.getItem('accessToken');
  if (!token) {
    isSyncing = false;
    notify('error', await db.syncQueue.count(), 'Нет авторизации');
    return { success: 0, failed: 0 };
  }

  const items = await db.syncQueue.orderBy('createdAt').toArray();
  let success = 0, failed = 0;

  notify('syncing', items.length);

  for (const item of items) {
    try {
      await processQueueItem(item, token);
      await db.syncQueue.delete(item.id!);
      success++;
    } catch (err: any) {
      const retryCount = (item.retryCount || 0) + 1;
      if (retryCount >= 5) {
        // Max retries exceeded — mark as failed and remove
        await db.syncQueue.delete(item.id!);
        failed++;
      } else {
        await db.syncQueue.update(item.id!, { retryCount, lastError: err.message });
        failed++;
      }
    }
    notify('syncing', items.length - success - failed);
  }

  isSyncing = false;
  const remaining = await db.syncQueue.count();
  notify('idle', remaining);
  return { success, failed };
}

async function processQueueItem(item: SyncQueueItem, token: string) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  };

  switch (`${item.operation}:${item.entityType}`) {
    case 'create:visit': {
      const visit = await db.visits.get(item.entityId);
      if (!visit) throw new Error('Visit not found locally');
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId: visit.addressId,
          engineerName: visit.engineerName,
          dateStart: visit.dateStart,
          timeStart: visit.timeStart,
          season: visit.season,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      await db.visits.update(item.entityId, { serverId: data.id, dirty: false });
      // Also update tasks with new visit server ID
      await db.tasks.where('visitLocalId').equals(item.entityId).modify({ visitServerId: data.id });
      break;
    }

    case 'update:visit': {
      const visit = await db.visits.get(item.entityId);
      if (!visit?.serverId) throw new Error('No server ID for visit');
      const res = await fetch(`/api/visits/${visit.serverId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId: visit.addressId,
          engineerName: visit.engineerName,
          dateStart: visit.dateStart,
          timeStart: visit.timeStart,
          season: visit.season,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.visits.update(item.entityId, { dirty: false });
      break;
    }

    case 'delete:visit': {
      const visit = await db.visits.get(item.entityId);
      if (!visit?.serverId) {
        // Never synced — just remove locally
        await db.visits.delete(item.entityId);
        break;
      }
      const res = await fetch(`/api/visits/${visit.serverId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.visits.delete(item.entityId);
      break;
    }

    case 'create:task': {
      const task = await db.tasks.get(item.entityId);
      if (!task) throw new Error('Task not found locally');
      const visitServerId = task.visitServerId || (await db.visits.get(task.visitLocalId))?.serverId;
      if (!visitServerId) throw new Error('Visit not synced yet');
      const res = await fetch(`/api/visits/${visitServerId}/tasks`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentTypeId: task.equipmentTypeId,
          roomTypeId: task.roomTypeId || '',
          objectEquipmentId: task.objectEquipmentId || '',
          comment: task.comment || '',
          brand: task.brand || '',
          model: task.model || '',
          serialNumber: task.serialNumber || '',
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      await db.tasks.update(item.entityId, { serverId: data.id, dirty: false });
      break;
    }

    case 'update:task': {
      const task = await db.tasks.get(item.entityId);
      if (!task?.serverId) throw new Error('No server ID for task');
      const visitServerId = task.visitServerId || (await db.visits.get(task.visitLocalId))?.serverId;
      if (!visitServerId) throw new Error('Visit not synced yet');
      const res = await fetch(`/api/visits/${visitServerId}/tasks/${task.serverId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameters: task.parameters,
          selectedRecommendationIds: task.selectedRecommendationIds,
          additionalRecommendations: task.additionalRecommendations,
          conclusion: task.conclusion,
          status: task.status,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.tasks.update(item.entityId, { dirty: false });
      break;
    }

    case 'delete:task': {
      const task = await db.tasks.get(item.entityId);
      if (!task?.serverId) {
        await db.tasks.delete(item.entityId);
        break;
      }
      const visitServerId = task.visitServerId || (await db.visits.get(task.visitLocalId))?.serverId;
      if (!visitServerId) throw new Error('Visit not synced yet');
      const res = await fetch(`/api/visits/${visitServerId}/tasks/${task.serverId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.tasks.delete(item.entityId);
      break;
    }

    case 'upload_photo:photo': {
      const photo = await db.photos.get(item.entityId);
      if (!photo) throw new Error('Photo not found locally');
      const taskServerId = photo.taskServerId || (await db.tasks.get(photo.taskLocalId))?.serverId;
      if (!taskServerId) throw new Error('Task not synced yet');
      const fd = new FormData();
      fd.append('photo', photo.blob, photo.fileName);
      fd.append('moment', photo.moment);
      const res = await fetch(`/api/tasks/${taskServerId}/photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      await db.photos.update(item.entityId, { serverId: data.id, dirty: false });
      break;
    }

    case 'complete:visit': {
      const visit = await db.visits.get(item.entityId);
      if (!visit?.serverId) throw new Error('No server ID for visit');
      const res = await fetch(`/api/visits/${visit.serverId}/complete`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.visits.update(item.entityId, { dirty: false, status: 'completed' });
      break;
    }

    case 'create:favorite': {
      const fav = await db.favorites.get(item.entityId);
      if (!fav) throw new Error('Favorite not found locally');
      const res = await fetch('/api/profile/favorites', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectCode: fav.objectCode }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.favorites.update(item.entityId, { dirty: false });
      break;
    }

    case 'delete:favorite': {
      const fav = await db.favorites.get(item.entityId);
      if (!fav) {
        // Already removed locally
        break;
      }
      const res = await fetch(`/api/profile/favorites/${fav.objectCode}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.favorites.delete(item.entityId);
      break;
    }

    // ─── MTR operations ────────────────────────────────────────
    case 'create:mtr_visit': {
      const mv = await db.mtrVisits.get(item.entityId);
      if (!mv) throw new Error('MTR visit not found locally');
      const res = await fetch('/api/mtr/visits', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId: mv.addressId,
          requestNumber: mv.requestNumber,
          dateStart: mv.dateStart,
          timeStart: mv.timeStart,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      await db.mtrVisits.update(item.entityId, { serverId: data.id, dirty: false });
      // Update works and photos with new visit server ID
      await db.mtrVisitWorks.where('mtrVisitLocalId').equals(item.entityId).modify({ mtrVisitServerId: data.id });
      await db.mtrPhotos.where('mtrVisitLocalId').equals(item.entityId).modify({ mtrVisitServerId: data.id });
      break;
    }

    case 'update:mtr_visit': {
      const mv = await db.mtrVisits.get(item.entityId);
      if (!mv?.serverId) throw new Error('No server ID for MTR visit');
      const res = await fetch(`/api/mtr/visits/${mv.serverId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId: mv.addressId,
          requestNumber: mv.requestNumber,
          dateStart: mv.dateStart,
          timeStart: mv.timeStart,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.mtrVisits.update(item.entityId, { dirty: false });
      break;
    }

    case 'delete:mtr_visit': {
      const mv = await db.mtrVisits.get(item.entityId);
      if (!mv?.serverId) {
        await db.mtrVisits.delete(item.entityId);
        break;
      }
      const res = await fetch(`/api/mtr/visits/${mv.serverId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.mtrVisits.delete(item.entityId);
      break;
    }

    case 'create:mtr_work': {
      const work = await db.mtrVisitWorks.get(item.entityId);
      if (!work) throw new Error('MTR work not found locally');
      const visitServerId = work.mtrVisitServerId || (await db.mtrVisits.get(work.mtrVisitLocalId))?.serverId;
      if (!visitServerId) throw new Error('MTR visit not synced yet');
      const res = await fetch(`/api/mtr/visits/${visitServerId}/works`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mtrWorkTypeId: work.mtrWorkTypeId,
          quantity: work.quantity,
          comment: work.comment || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      await db.mtrVisitWorks.update(item.entityId, { serverId: data.id, dirty: false });
      break;
    }

    case 'delete:mtr_work': {
      const work = await db.mtrVisitWorks.get(item.entityId);
      if (!work?.serverId) {
        await db.mtrVisitWorks.delete(item.entityId);
        break;
      }
      const visitServerId = work.mtrVisitServerId || (await db.mtrVisits.get(work.mtrVisitLocalId))?.serverId;
      if (!visitServerId) throw new Error('MTR visit not synced yet');
      const res = await fetch(`/api/mtr/visits/${visitServerId}/works/${work.serverId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.mtrVisitWorks.delete(item.entityId);
      break;
    }

    case 'upload_photo:mtr_photo': {
      const photo = await db.mtrPhotos.get(item.entityId);
      if (!photo) throw new Error('MTR photo not found locally');
      const visitServerId = photo.mtrVisitServerId || (await db.mtrVisits.get(photo.mtrVisitLocalId))?.serverId;
      if (!visitServerId) throw new Error('MTR visit not synced yet');
      const fd = new FormData();
      fd.append('photo', photo.blob, photo.fileName);
      fd.append('moment', photo.moment);
      const res = await fetch(`/api/photos/mtr-visits/${visitServerId}/photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      await db.mtrPhotos.update(item.entityId, { serverId: data.id, dirty: false });
      break;
    }

    case 'complete:mtr_visit': {
      const mv = await db.mtrVisits.get(item.entityId);
      if (!mv?.serverId) throw new Error('No server ID for MTR visit');
      const res = await fetch(`/api/mtr/visits/${mv.serverId}/complete`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      await db.mtrVisits.update(item.entityId, { dirty: false, status: 'sent' });
      break;
    }

    default:
      throw new Error(`Unknown operation: ${item.operation}:${item.entityType}`);
  }
}

// ─── PULL FROM SERVER ─────────────────────────────────────────
export async function pullVisitsFromServer(): Promise<number> {
  const token = localStorage.getItem('accessToken');
  if (!token) return 0;

  const pageSize = 100;
  let page = 1;
  let allData: any[] = [];
  let totalCount = 0;

  while (true) {
    const res = await fetch(`/api/visits?page=${page}&pageSize=${pageSize}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return 0;

    const json = await res.json();
    const { data, total } = json;
    allData = allData.concat(data || []);
    totalCount = total || 0;

    if (allData.length >= totalCount || !data?.length) break;
    page++;
  }

  let count = 0;

  for (const sv of allData) {
    const existing = await db.visits.where('serverId').equals(sv.id).first();
    if (existing && !existing.dirty) {
      // Update from server (only if not dirty)
      await db.visits.update(existing.id, {
        status: sv.status,
        timeEnd: sv.timeEnd,
        engineerName: sv.engineerName,
        updatedAt: sv.updatedAt || new Date().toISOString(),
      });
    } else if (!existing) {
      // New from server
      await db.visits.add({
        id: `server_${sv.id}`,
        serverId: sv.id,
        userId: sv.userId,
        addressId: sv.addressId,
        engineerName: sv.engineerName,
        dateStart: sv.dateStart,
        timeStart: sv.timeStart,
        timeEnd: sv.timeEnd,
        season: sv.season,
        status: sv.status,
        isDeleted: sv.isDeleted || false,
        createdAt: sv.createdAt || new Date().toISOString(),
        updatedAt: sv.updatedAt || new Date().toISOString(),
        dirty: false,
      });
      count++;
    }
  }

  return count;
}

// ─── CACHE REFERENCE DATA ─────────────────────────────────────
export async function cacheRefData(key: string, data: any) {
  await db.cachedRefs.put({ key, data, updatedAt: new Date().toISOString() });
}

export async function getCachedRefData(key: string): Promise<any | null> {
  const entry = await db.cachedRefs.get(key);
  return entry?.data || null;
}

// ─── PULL FAVORITES FROM SERVER ───────────────────────────────
export async function pullFavoritesFromServer(): Promise<number> {
  const token = localStorage.getItem('accessToken');
  if (!token) return 0;

  const res = await fetch('/api/profile/favorites', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return 0;

  const data = await res.json();
  const favorites: any[] = Array.isArray(data) ? data : (data.data || []);
  let count = 0;

  for (const sf of favorites) {
    const existing = await db.favorites.where('objectCode').equals(sf.objectCode).first();
    if (!existing) {
      await db.favorites.add({
        id: `server_${sf.id || sf.objectCode}`,
        userId: sf.userId || '',
        objectCode: sf.objectCode,
        addedAt: sf.addedAt || sf.createdAt || new Date().toISOString(),
        dirty: false,
      });
      count++;
    } else if (!existing.dirty) {
      await db.favorites.update(existing.id, { dirty: false });
    }
  }

  return count;
}

// ─── FULL SYNC ────────────────────────────────────────────────
export async function fullSync(): Promise<{ pushed: { success: number; failed: number }; pulled: number }> {
  const pushed = await processSyncQueue();
  const pulled = await pullVisitsFromServer();
  await pullFavoritesFromServer();

  const role = useAuthStore.getState().user?.role;
  if (role === 'engineer_mtr' || role === 'tm_mtr' || role === 'admin') {
    await pullMtrVisitsFromServer();
    await cacheMtrWorkTypes();
  }

  return { pushed, pulled };
}

// ─── PULL MTR VISITS FROM SERVER ─────────────────────────────
export async function pullMtrVisitsFromServer(): Promise<number> {
  const token = localStorage.getItem('accessToken');
  if (!token) return 0;

  const pageSize = 100;
  let page = 1;
  let allData: any[] = [];
  let totalCount = 0;

  while (true) {
    const res = await fetch(`/api/mtr/visits?page=${page}&pageSize=${pageSize}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return 0;

    const json = await res.json();
    const { data, total } = json;
    allData = allData.concat(data || []);
    totalCount = total || 0;

    if (allData.length >= totalCount || !data?.length) break;
    page++;
  }

  let count = 0;

  for (const sv of allData) {
    const existing = await db.mtrVisits.where('serverId').equals(sv.id).first();
    if (existing && !existing.dirty) {
      await db.mtrVisits.update(existing.id, {
        status: sv.status,
        isDraft: sv.isDraft,
        updatedAt: sv.updatedAt || new Date().toISOString(),
      });
    } else if (!existing) {
      await db.mtrVisits.add({
        id: `server_mtr_${sv.id}`,
        serverId: sv.id,
        engineerId: sv.engineerId,
        addressId: sv.addressId,
        requestNumber: sv.requestNumber,
        dateStart: sv.dateStart ? new Date(sv.dateStart).toISOString().slice(0, 10) : '',
        timeStart: sv.timeStart || '',
        status: sv.status,
        isDraft: sv.isDraft ?? false,
        createdAt: sv.createdAt || new Date().toISOString(),
        updatedAt: sv.updatedAt || new Date().toISOString(),
        dirty: false,
      });
      count++;
    }
  }

  return count;
}

// ─── CACHE MTR WORK TYPES ────────────────────────────────────
export async function cacheMtrWorkTypes() {
  const token = localStorage.getItem('accessToken');
  if (!token) return;

  const cached = await getCachedRefData('mtr-work-types');
  if (cached && cached._cachedAt) {
    const age = Date.now() - new Date(cached._cachedAt).getTime();
    if (age < 3600000) return; // 1 hour
  }

  try {
    const res = await fetch('/api/mtr/work-types/all', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    await cacheRefData('mtr-work-types', { items: data, _cachedAt: new Date().toISOString() });
  } catch {
    // Ignore errors — will retry next sync
  }
}
