import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { theme, darkTheme } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useThemeStore } from '../src/stores/themeStore';
import { useAutoSync } from '../src/sync/useAutoSync';
import { useAutoLock } from '../src/hooks/useAutoLock';
import { registerForPushNotifications, setupNotificationListeners } from '../src/services/pushNotifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);
  const themeMode = useThemeStore((state) => state.mode);
  const systemScheme = useColorScheme();

  useAutoSync();
  useAutoLock();

  useEffect(() => {
    initialize();
    useThemeStore.getState().initialize();
    setupNotificationListeners();
  }, []);

  useEffect(() => {
    (async () => {
      const pushEnabled = await SecureStore.getItemAsync('push_enabled');
      if (pushEnabled !== 'false') {
        await registerForPushNotifications();
      }
    })();
  }, [isLoading]);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');
  const activeTheme = isDark ? darkTheme : theme;

  if (isLoading) {
    return null;
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
