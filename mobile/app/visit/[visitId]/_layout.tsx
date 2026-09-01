import { Stack } from 'expo-router';

export default function VisitDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-equipment" />
      <Stack.Screen name="report" />
      <Stack.Screen name="conflicts" />
      <Stack.Screen name="task" />
    </Stack>
  );
}
