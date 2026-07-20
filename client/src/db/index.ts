import Dexie, { type Table } from 'dexie';

export interface LocalVisit {
  id: string;
  serverId?: string; // ID from server (empty until synced)
  userId: string;
  addressId: string;
  engineerName: string;
  dateStart: string;
  timeStart: string;
  timeEnd?: string;
  season: 'summer' | 'winter';
  status: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  dirty: boolean; // true = needs sync
}

export interface LocalTask {
  id: string;
  serverId?: string;
  visitLocalId: string;
  visitServerId?: string;
  taskType: string;
  equipmentTypeId: string;
  roomTypeId?: string;
  roomTypeCode?: string;
  objectEquipmentId?: string;
  comment?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  sortOrder: number;
  status: string;
  parameters?: Record<string, unknown>;
  selectedRecommendationIds: string[];
  additionalRecommendations?: string;
  conclusion?: string;
  createdAt: string;
  updatedAt: string;
  dirty: boolean;
}

export interface LocalTaskEquipmentItem {
  id: string;
  serverId?: string;
  taskLocalId: string;
  taskServerId?: string;
  objectEquipmentId: string;
  status?: string;
  sortOrder: number;
  createdAt: string;
  dirty: boolean;
}

export interface LocalPhoto {
  id: string;
  serverId?: string;
  taskLocalId: string;
  taskServerId?: string;
  taskEquipmentItemLocalId?: string;
  taskEquipmentItemServerId?: string;
  blob: Blob;
  fileName: string;
  moment: 'before' | 'after';
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  dirty: boolean;
}

export interface LocalFavorite {
  id: string;
  userId: string;
  objectCode: string;
  addedAt: string;
  dirty: boolean;
}

export interface SyncQueueItem {
  id?: number;
  operation: 'create' | 'update' | 'delete' | 'upload_photo' | 'complete' | 'send_report' | 'reassign';
  entityType: 'visit' | 'task' | 'task_equipment_item' | 'photo' | 'report' | 'favorite';
  entityId: string;
  payload?: any;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface CachedRef {
  key: string; // e.g. 'equipment-types', 'room-types', 'addresses'
  data: any;
  updatedAt: string;
}

class ChecklistDB extends Dexie {
  visits!: Table<LocalVisit, string>;
  tasks!: Table<LocalTask, string>;
  taskEquipmentItems!: Table<LocalTaskEquipmentItem, string>;
  photos!: Table<LocalPhoto, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  cachedRefs!: Table<CachedRef, string>;
  favorites!: Table<LocalFavorite, string>;

  constructor() {
    super('ChecklistDB');
    this.version(1).stores({
      visits: 'id, serverId, userId, status, dirty, isDeleted',
      tasks: 'id, serverId, visitLocalId, visitServerId, dirty',
      photos: 'id, serverId, taskLocalId, taskServerId, dirty',
      syncQueue: '++id, entityType, entityId, createdAt',
      cachedRefs: 'key',
    });
    this.version(2).stores({
      visits: 'id, serverId, userId, status, dirty, isDeleted',
      tasks: 'id, serverId, visitLocalId, visitServerId, dirty',
      photos: 'id, serverId, taskLocalId, taskServerId, dirty',
      syncQueue: '++id, entityType, entityId, createdAt',
      cachedRefs: 'key',
      favorites: 'id, userId, objectCode, addedAt',
    });
    this.version(3).stores({
      visits: 'id, serverId, userId, status, dirty, isDeleted',
      tasks: 'id, serverId, visitLocalId, visitServerId, dirty',
      taskEquipmentItems: 'id, serverId, taskLocalId, taskServerId, dirty',
      photos: 'id, serverId, taskLocalId, taskServerId, taskEquipmentItemLocalId, taskEquipmentItemServerId, dirty',
      syncQueue: '++id, entityType, entityId, createdAt',
      cachedRefs: 'key',
      favorites: 'id, userId, objectCode, addedAt',
    });
  }
}

export const db = new ChecklistDB();

// Helper: generate local ID
export function localId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Helper: add to sync queue
export async function enqueueSync(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>) {
  await db.syncQueue.add({
    ...item,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

// Helper: get pending sync count
export async function getPendingSyncCount(): Promise<number> {
  return await db.syncQueue.count();
}
