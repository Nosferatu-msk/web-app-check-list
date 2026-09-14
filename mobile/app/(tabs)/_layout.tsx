import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { theme } from '../../src/theme';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const currentTheme = colorScheme === 'dark' ? theme.dark : theme.light;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: currentTheme.colors.primary,
        tabBarInactiveTintColor: currentTheme.colors.secondary,
        tabBarStyle: {
          position: 'absolute',
          bottom: 42,
          height: 63,
          backgroundColor: currentTheme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: currentTheme.colors.outline,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
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
        name="requests"
        options={{
          title: 'Заявки',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-document" size={size} color={color} />
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
