import { Stack } from 'expo-router';

export default function VisitLayout() {
  return (
    <Stack>
      <Stack.Screen name="new" options={{ title: 'Новый визит' }} />
      <Stack.Screen name="[visitId]" options={{ title: 'Визит' }} />
    </Stack>
  );
}
