import { create } from 'zustand';
import { getDatabase } from '../db';
import api from '../api/client';
import * as SQLite from 'expo-sqlite';

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: Date | null;
  error: string | null;
  cancelled: boolean;

  // Actions
  addToQueue: (mutation: SyncMutation) => Promise<void>;
  sync: () => Promise<void>;
  cancelSync: () => void;
  clearError: () => void;
  refreshPendingCount: () => Promise<void>;
}

export interface SyncMutation {
  client_mutation_id: string;
  entity_type: 'visit' | 'task' | 'photo';
  entity_id: string;
  action: 'create' | 'update' | 'delete';
  payload: any;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  pendingCount: 0,
  lastSyncAt: null,
  error: null,
  cancelled: false,

  addToQueue: async (mutation: SyncMutation) => {
    const db = await getDatabase();
    
    await db.runAsync(
      `INSERT INTO sync_queue (client_mutation_id, entity_type, entity_id, action, payload, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [
        mutation.client_mutation_id,
        mutation.entity_type,
        mutation.entity_id,
        mutation.action,
        JSON.stringify(mutation.payload),
        new Date().toISOString(),
      ]
    );

    await get().refreshPendingCount();
  },

  sync: async () => {
    const state = get();
    if (state.status === 'syncing') return;

    set({ status: 'syncing', error: null, cancelled: false });

    // Таймаут: если синхронизация зависнет — возвращаем в idle через 10 сек
    const timeout = setTimeout(() => {
      const current = get();
      if (current.status === 'syncing') {
        set({ status: 'idle', error: null });
      }
    }, 10000);

    try {
      const db = await getDatabase();
      
      // Получаем все pending мутации
      const mutations = await db.getAllAsync<any>(
        `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50`
      );

      if (mutations.length === 0) {
        clearTimeout(timeout);
        set({ status: 'idle' });
        return;
      }

      // Exponential backoff: задержка перед retry на основе максимального retry_count
      const maxRetryCount = Math.max(...mutations.map((m: any) => m.retry_count || 0));
      if (maxRetryCount > 0) {
        const delay = Math.min(1000 * Math.pow(2, maxRetryCount - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Формируем batch запрос
      const batchMutations = mutations.map((m: any) => ({
        client_mutation_id: m.client_mutation_id,
        entity_type: m.entity_type,
        entity_id: m.entity_id,
        action: m.action,
        payload: JSON.parse(m.payload),
      }));

      // Отправляем batch
      const response = await api.post('/sync/batch', { mutations: batchMutations });
      const results = response.data.results;

      // Обновляем статус каждой мутации
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        const result = results[i];

        if (result.status === 'completed') {
          await db.runAsync(
            `UPDATE sync_queue SET status = 'completed' WHERE id = ?`,
            [mutation.id]
          );
        } else if (result.status === 'failed') {
          const retryCount = mutation.retry_count + 1;
          const newStatus = retryCount >= mutation.max_retries ? 'failed' : 'pending';

          // Пометка конфликта при 409
          const isConflict = result.error?.includes('409') || result.error?.includes('conflict');
          const syncError = isConflict ? 'CONFLICT: ' + (result.error || '') : result.error;

          await db.runAsync(
            `UPDATE sync_queue SET status = ?, retry_count = ?, error = ? WHERE id = ?`,
            [newStatus, retryCount, syncError, mutation.id]
          );
        }
      }

      clearTimeout(timeout);
      set({
        status: 'idle',
        lastSyncAt: new Date(),
      });

      await get().refreshPendingCount();
    } catch (error: any) {
      clearTimeout(timeout);
      console.error('Sync error:', error);
      set({
        status: 'idle',
        error: error.message || 'Ошибка синхронизации',
      });
    }
  },

  cancelSync: () => {
    set({ cancelled: true, status: 'idle' });
  },

  clearError: () => {
    set({ error: null, cancelled: false });
  },

  refreshPendingCount: async () => {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`
    );
    set({ pendingCount: result?.count || 0 });
  },
}));
