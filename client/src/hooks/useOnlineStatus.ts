import { useState, useEffect, useCallback } from 'react';
import { fullSync, onSyncStatusChange, processSyncQueue } from '../db/sync';
import { getPendingSyncCount } from '../db';

type SyncStatus = 'idle' | 'syncing' | 'error';

interface OnlineState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncError?: string;
  sync: () => Promise<void>;
}

export function useOnlineStatus(): OnlineState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncError, setLastSyncError] = useState<string>();

  const updatePending = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncStatus('syncing');
    try {
      const result = await fullSync();
      if (result.pushed.failed > 0) {
        setLastSyncError(`Не удалось синхронизировать: ${result.pushed.failed}`);
        setSyncStatus('error');
      } else {
        setLastSyncError(undefined);
        setSyncStatus('idle');
      }
      await updatePending();
    } catch (err: any) {
      setLastSyncError(err.message);
      setSyncStatus('error');
    }
  }, [updatePending]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('idle');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen to sync status changes from sync engine
    const unsub = onSyncStatusChange((status, pending, error) => {
      setSyncStatus(status);
      setPendingCount(pending);
      if (error) setLastSyncError(error);
    });

    // Initial pending count
    updatePending();

    // Sync on mount if online
    if (navigator.onLine) {
      sync();
    }

    // Periodic sync every 60 seconds when online
    const interval = setInterval(() => {
      if (navigator.onLine) sync();
    }, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
      clearInterval(interval);
    };
  }, [sync, updatePending]);

  return { isOnline, syncStatus, pendingCount, lastSyncError, sync };
}
