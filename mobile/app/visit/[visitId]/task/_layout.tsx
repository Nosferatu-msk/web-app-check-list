import { Stack } from 'expo-router';

export default function TaskLayout() {
  return (
    <Stack>
      <Stack.Screen name="[taskId]" options={{ headerShown: false }} />
      <Stack.Screen name="[taskId]/photos" options={{ headerShown: false }} />
    </Stack>
  );
}
