import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Switch, List, SegmentedButtons } from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore, ThemeMode } from '../../src/stores/themeStore';
import SyncIndicator from '../../src/components/SyncIndicator';
import NotificationBell from '../../src/components/NotificationBell';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  isPinSet,
} from '../../src/utils/biometric';
import { registerForPushNotifications } from '../../src/services/pushNotifications';
import { STATUS_BAR_HEIGHT, BOTTOM_PADDING_TAB_SCREEN } from '../../src/constants/layout';

export default function ProfileScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);

  useEffect(() => {
    (async () => {
      const bioAvailable = await isBiometricAvailable();
      const bioEnabled = await isBiometricEnabled();
      const pinIsSet = await isPinSet();
      const pushStored = await SecureStore.getItemAsync('push_enabled');

      setBiometricAvailable(bioAvailable);
      setBiometricEnabled(bioEnabled);
      setPinSet(pinIsSet);
      setPushEnabled(pushStored !== 'false');
    })();
  }, []);

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      await enableBiometric();
      setBiometricEnabled(true);
    } else {
      await disableBiometric();
      setBiometricEnabled(false);
    }
  };

  const handleTogglePush = async (value: boolean) => {
    if (value) {
      await SecureStore.setItemAsync('push_enabled', 'true');
      setPushEnabled(true);
      await registerForPushNotifications();
    } else {
      await SecureStore.setItemAsync('push_enabled', 'false');
      setPushEnabled(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.profileHeader}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Профиль</Text>
        <View style={styles.headerActions}>
          <NotificationBell />
          <SyncIndicator />
        </View>
      </View>

      {/* Информация о пользователе */}
      {user && (
        <View style={[styles.userInfo, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.avatarText, { color: theme.colors.surface }]}>
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.userInfoText}>
            <Text variant="titleLarge" style={[styles.userName, { color: theme.colors.text }]}>
              {user.fullName}
            </Text>
            <Text variant="bodyMedium" style={[styles.userEmail, { color: theme.colors.placeholder }]}>
              {user.email}
            </Text>
            <Text variant="bodySmall" style={[styles.userRole, { color: theme.colors.primary }]}>
              {user.role === 'engineer' ? 'Инженер ТО' : user.role}
            </Text>
          </View>
        </View>
      )}

      {/* Настройки безопасности */}
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.text }]}>Безопасность</Text>

      {biometricAvailable && (
        <List.Item
          title="Биометрия"
          description="Вход по отпечатку или лицу"
          right={() => (
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              accessibilityLabel="Вход по биометрии"
            />
          )}
          style={[styles.listItem, { backgroundColor: theme.colors.surface }]}
        />
      )}

      <List.Item
        title="PIN-код"
        description={pinSet ? 'Установлен' : 'Не установлен'}
        right={() => (
          <Button
            mode="text"
            onPress={() => router.push('/(auth)/pin-setup')}
            compact
            accessibilityLabel={pinSet ? 'Изменить PIN-код' : 'Установить PIN-код'}
          >
            {pinSet ? 'Изменить' : 'Установить'}
          </Button>
        )}
        style={[styles.listItem, { backgroundColor: theme.colors.surface }]}
      />

      {/* Push-уведомления */}
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.text }]}>Уведомления</Text>

      <List.Item
        title="Push-уведомления"
        description="Новые задачи и напоминания"
        right={() => (
          <Switch
            value={pushEnabled}
            onValueChange={handleTogglePush}
            accessibilityLabel="Push-уведомления"
          />
        )}
        style={[styles.listItem, { backgroundColor: theme.colors.surface }]}
      />

      {/* Тема */}
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.text }]}>Оформление</Text>
      <SegmentedButtons
        value={themeMode}
        onValueChange={(v) => setThemeMode(v as ThemeMode)}
        buttons={[
          { value: 'light', label: 'Светлая' },
          { value: 'dark', label: 'Тёмная' },
          { value: 'system', label: 'Системная' },
        ]}
        style={styles.themeButtons}
        theme={{ colors: { secondaryContainer: '#E0F2F1' } }}
      />

      {/* Выход */}
      <Button
        mode="outlined"
        onPress={handleLogout}
        style={[styles.logoutButton, { borderColor: theme.colors.error }]}
        icon="logout"
        accessibilityLabel="Выйти из аккаунта"
      >
        Выйти из аккаунта
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: STATUS_BAR_HEIGHT + 16,
    paddingBottom: BOTTOM_PADDING_TAB_SCREEN,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  userInfo: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  userInfoText: {
    flex: 1,
  },
  userName: {
    fontWeight: '600',
  },
  userEmail: {
    marginTop: 4,
  },
  userRole: {
    textTransform: 'uppercase',
    marginTop: 4,
    fontWeight: '600',
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  listItem: {
    borderRadius: 8,
    marginBottom: 8,
  },
  themeSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  themeLabel: {
    marginBottom: 12,
  },
  themeButtons: {
    marginTop: 4,
  },
  logoutButton: {
    marginTop: 24,
  },
});
