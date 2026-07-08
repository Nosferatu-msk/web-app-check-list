import { db, type SyncQueueItem, type LocalVisit, type LocalTask, type LocalPhoto } from './index';

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
          location: task.location || '',
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

    default:
      throw new Error(`Unknown operation: ${item.operation}:${item.entityType}`);
  }
}

// ─── PULL FROM SERVER ─────────────────────────────────────────
export async function pullVisitsFromServer(): Promise<number> {
  const token = localStorage.getItem('accessToken');
  if (!token) return 0;

  const res = await fetch('/api/visits?pageSize=100', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return 0;

  const { data } = await res.json();
  let count = 0;

  for (const sv of data) {
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

// ─── FULL SYNC ────────────────────────────────────────────────
export async function fullSync(): Promise<{ pushed: { success: number; failed: number }; pulled: number }> {
  const pushed = await processSyncQueue();
  const pulled = await pullVisitsFromServer();
  return { pushed, pulled };
}
