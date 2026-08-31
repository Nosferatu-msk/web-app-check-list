import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const needsUnlock = useAuthStore((state) => state.needsUnlock);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return null; // Загрузка
  }

  if (!isAuthenticated && !needsUnlock) {
    return <Redirect href="/(auth)/login" />;
  }

  if (needsUnlock) {
    return <Redirect href="/(auth)/unlock" />;
  }

  return <Redirect href="/(tabs)/visits" />;
}
