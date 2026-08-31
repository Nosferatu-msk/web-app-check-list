import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут

/**
 * Хук для автоматической блокировки приложения при неактивности.
 * Блокировка происходит при переходе в фон/неактивное состояние на 5+ минут.
 */
export function useAutoLock() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const backgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Запоминаем время ухода в фон
        backgroundTimeRef.current = Date.now();
      } else if (nextAppState === 'active' && backgroundTimeRef.current) {
        // Проверяем, сколько времени были в фоне
        const timeInBackground = Date.now() - backgroundTimeRef.current;
        
        if (timeInBackground >= LOCK_TIMEOUT_MS) {
          // Блокируем приложение — переходим на экран разблокировки
          router.replace('/(auth)/unlock');
        }
        
        backgroundTimeRef.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, router]);
}
