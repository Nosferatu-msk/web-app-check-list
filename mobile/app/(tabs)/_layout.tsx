import { Tabs, usePathname } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NAV_BAR_HEIGHT } from '../../src/constants/layout';
import { useVisits } from '../../src/api/queries';
import { useAppTheme } from '../../src/hooks/useAppTheme';

export default function TabsLayout() {
  const { data: activeVisits } = useVisits('active');
  const activeCount = activeVisits?.length || 0;
  const theme = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.placeholder,
        tabBarActiveBackgroundColor: theme.colors.surface,
        tabBarInactiveBackgroundColor: theme.colors.surface,
        tabBarStyle: {
          position: 'absolute',
          bottom: NAV_BAR_HEIGHT,
          height: 63,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          elevation: 0,
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
          tabBarBadge: activeCount > 0 ? activeCount : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.colors.primary, fontSize: 11, fontWeight: '700' },
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Заявки',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-document-outline" size={size} color={color} />
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
