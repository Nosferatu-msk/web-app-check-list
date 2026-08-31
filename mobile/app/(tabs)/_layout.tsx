import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0F766E',
        tabBarInactiveTintColor: '#64748B',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Визиты',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-check" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
