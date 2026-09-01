import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Switch, List, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore, ThemeMode } from '../../src/stores/themeStore';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  isPinSet,
} from '../../src/utils/biometric';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pinSet, setPinSet] = useState(false);

  useEffect(() => {
    (async () => {
      const bioAvailable = await isBiometricAvailable();
      const bioEnabled = await isBiometricEnabled();
      const pinIsSet = await isPinSet();

      setBiometricAvailable(bioAvailable);
      setBiometricEnabled(bioEnabled);
      setPinSet(pinIsSet);
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

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>Профиль</Text>

      {/* Информация о пользователе */}
      {user && (
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.userInfoText}>
            <Text variant="titleLarge" style={styles.userName}>
              {user.fullName}
            </Text>
            <Text variant="bodyMedium" style={styles.userEmail}>
              {user.email}
            </Text>
            <Text variant="bodySmall" style={styles.userRole}>
              {user.role === 'engineer' ? 'Инженер ТО' : user.role}
            </Text>
          </View>
        </View>
      )}

      {/* Настройки безопасности */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Безопасность</Text>

      {biometricAvailable && (
        <List.Item
          title="Биометрия"
          description="Вход по отпечатку или лицу"
          right={() => (
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
            />
          )}
          style={styles.listItem}
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
          >
            {pinSet ? 'Изменить' : 'Установить'}
          </Button>
        )}
        style={styles.listItem}
      />

      {/* Тема */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Внешний вид</Text>
      <View style={styles.themeSection}>
        <Text variant="bodyMedium" style={styles.themeLabel}>Тема оформления</Text>
        <SegmentedButtons
          value={themeMode}
          onValueChange={(value) => setThemeMode(value as ThemeMode)}
          buttons={[
            { value: 'light', label: 'Светлая' },
            { value: 'system', label: 'Системная' },
            { value: 'dark', label: 'Тёмная' },
          ]}
          style={styles.themeButtons}
        />
      </View>

      {/* Выход */}
      <Button
        mode="outlined"
        onPress={handleLogout}
        style={styles.logoutButton}
        icon="logout"
      >
        Выйти из аккаунта
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  title: {
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 24,
  },
  userInfo: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#0F766E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  userInfoText: {
    flex: 1,
  },
  userName: {
    fontWeight: '600',
    color: '#0F172A',
  },
  userEmail: {
    color: '#64748B',
    marginTop: 4,
  },
  userRole: {
    color: '#0F766E',
    textTransform: 'uppercase',
    marginTop: 4,
    fontWeight: '600',
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
    marginTop: 16,
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
  },
  themeSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  themeLabel: {
    color: '#0F172A',
    marginBottom: 12,
  },
  themeButtons: {
    marginTop: 4,
  },
  logoutButton: {
    marginTop: 24,
    borderColor: '#DC2626',
  },
});
