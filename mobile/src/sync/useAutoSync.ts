import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { useSyncStore } from './engine';

/**
 * Хук для автоматической синхронизации при:
 * - Появлении сети
 * - Возврате в приложение
 * - Интервале 60 секунд
 */
export function useAutoSync() {
  const sync = useSyncStore((state) => state.sync);
  const status = useSyncStore((state) => state.status);

  useEffect(() => {
    // Слушаем изменение состояния сети
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        sync();
      }
    });

    // Слушаем возврат в приложение
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        sync();
      }
    });

    // Интервальная синхронизация каждые 60 секунд
    const interval = setInterval(() => {
      if (status !== 'syncing') {
        sync();
      }
    }, 60000);

    return () => {
      unsubscribeNetInfo();
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [sync, status]);
}
