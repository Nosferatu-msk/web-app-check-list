import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import api from '../api/client';

export default function NotificationBell() {
  const theme = useAppTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const response = await api.get('/notifications/unread-count');
        setUnreadCount(response.data?.count || 0);
      } catch {
        // API may not support this endpoint yet
      }
    })();
  }, []);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Уведомления: ${unreadCount} непрочитанных` : 'Уведомления'}
    >
      <MaterialCommunityIcons name="bell-outline" size={22} color={theme.colors.placeholder} />
      {unreadCount > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
          <Text style={[styles.badgeText, { color: theme.colors.surface }]}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
