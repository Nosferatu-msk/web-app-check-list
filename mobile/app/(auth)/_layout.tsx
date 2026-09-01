import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="biometric-setup" />
      <Stack.Screen name="pin-setup" />
      <Stack.Screen name="unlock" />
    </Stack>
  );
}
