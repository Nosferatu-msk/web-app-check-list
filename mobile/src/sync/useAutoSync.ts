import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { useSyncStore } from './engine';

export function useAutoSync() {
  const sync = useSyncStore((state) => state.sync);
  const status = useSyncStore((state) => state.status);
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    const doSync = () => {
      const now = Date.now();
      if (now - lastSyncRef.current < 5000) return; // не чаще раза в 5 секунд
      lastSyncRef.current = now;
      sync();
    };

    // Небольшая задержка при старте — даём приложению инициализироваться
    const startTimeout = setTimeout(() => doSync(), 2000);

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        doSync();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        doSync();
      }
    });

    const interval = setInterval(() => {
      if (status !== 'syncing') {
        doSync();
      }
    }, 60000);

    return () => {
      clearTimeout(startTimeout);
      unsubscribeNetInfo();
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [sync, status]);
}
