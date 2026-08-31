import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme, darkTheme } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useThemeStore } from '../src/stores/themeStore';
import { useAutoSync } from '../src/sync/useAutoSync';
import { useAutoLock } from '../src/hooks/useAutoLock';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 минут
    },
  },
});

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  const systemColorScheme = useColorScheme();
  const themeMode = useThemeStore((state) => state.mode);
  const initializeTheme = useThemeStore((state) => state.initialize);

  // Определяем активную тему
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
  const activeTheme = isDark ? darkTheme : theme;

  // Автоматическая синхронизация для авторизованных пользователей
  useAutoSync();
  
  // Автоматическая блокировка при неактивности 5+ минут
  useAutoLock();

  useEffect(() => {
    initialize();
    initializeTheme();
  }, []);

  if (isLoading) {
    return null; // Или splash screen
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={activeTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="visit" />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  );
}
