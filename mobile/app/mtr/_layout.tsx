import { Stack } from 'expo-router';

export default function MtrLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="visits" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
