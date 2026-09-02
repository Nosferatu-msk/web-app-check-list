import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const needsUnlock = useAuthStore((state) => state.needsUnlock);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated && !needsUnlock) {
    return <Redirect href="/(auth)/login" />;
  }

  if (needsUnlock) {
    return <Redirect href="/(auth)/unlock" />;
  }

  const isMtr = user?.role === 'engineer_mtr' || user?.role === 'tm_mtr';
  return <Redirect href={isMtr ? '/mtr/visits' : '/(tabs)/visits'} />;
}
