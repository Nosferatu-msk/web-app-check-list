import { Stack } from 'expo-router';

export default function VisitLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="new" />
      <Stack.Screen name="[visitId]" />
    </Stack>
  );
}
