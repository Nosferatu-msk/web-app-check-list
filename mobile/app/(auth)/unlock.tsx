import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  isBiometricAvailable,
  authenticateWithBiometric,
  isBiometricEnabled,
  isPinSet,
  verifyPinCode,
} from '../../src/utils/biometric';
import { useAuthStore } from '../../src/stores/authStore';

export default function UnlockScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const unlock = useAuthStore((state) => state.unlock);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const bioAvailable = await isBiometricAvailable();
      const bioEnabled = await isBiometricEnabled();
      const pinIsSet = await isPinSet();

      setBiometricAvailable(bioAvailable);
      setBiometricEnabled(bioEnabled);
      setPinSet(pinIsSet);

      // Автоматически пробуем биометрию при загрузке
      if (bioAvailable && bioEnabled) {
        handleBiometricAuth();
      } else if (pinIsSet) {
        setShowPinInput(true);
      }
    })();
  }, []);

  const handleUnlock = async () => {
    setLoading(true);
    setError('');
    try {
      await unlock();
      router.replace('/(tabs)/visits');
    } catch (err) {
      setError('Сессия истекла. Войдите заново.');
      setTimeout(() => router.replace('/(auth)/login'), 2000);
    }
    setLoading(false);
  };

  const handleBiometricAuth = async () => {
    setLoading(true);
    setError('');

    const success = await authenticateWithBiometric();

    if (success) {
      await handleUnlock();
    } else {
      setError('Не удалось распознать. Попробуйте ещё раз или введите PIN.');
      if (pinSet) {
        setShowPinInput(true);
      }
    }

    setLoading(false);
  };

  const handlePinSubmit = async () => {
    if (!pin) {
      setError('Введите PIN-код');
      return;
    }

    setLoading(true);
    setError('');

    const valid = await verifyPinCode(pin);

    if (valid) {
      await handleUnlock();
    } else {
      setError('Неверный PIN-код');
      setPin('');
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    const logout = useAuthStore.getState().logout;
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.card}>
        <MaterialCommunityIcons name="lock" size={64} color={theme.colors.primary} />
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.text }]}>
          Чек-лист инженера
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.placeholder }]}>
          Приложение заблокировано
        </Text>

        {error ? (
          <Text variant="bodyMedium" style={[styles.error, { color: theme.colors.error }]}>
            {error}
          </Text>
        ) : null}

        {showPinInput ? (
          <View style={styles.pinSection}>
            <TextInput
              label="PIN-код"
              value={pin}
              onChangeText={setPin}
              mode="outlined"
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              style={styles.pinInput}
              onSubmitEditing={handlePinSubmit}
            />
            <Button
              mode="contained"
              onPress={handlePinSubmit}
              loading={loading}
              disabled={loading}
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
            >
              Разблокировать
            </Button>
          </View>
        ) : (
          biometricAvailable &&
          biometricEnabled && (
            <Button
              mode="contained"
              onPress={handleBiometricAuth}
              loading={loading}
              disabled={loading}
              icon="fingerprint"
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
            >
              Разблокировать
            </Button>
          )
        )}

        {biometricAvailable && biometricEnabled && showPinInput && (
          <Button
            mode="text"
            onPress={handleBiometricAuth}
            icon="fingerprint"
            style={styles.biometricButton}
          >
            Использовать биометрию
          </Button>
        )}

        <Button
          mode="text"
          onPress={handleLogout}
          style={styles.logoutButton}
          textColor={theme.colors.placeholder}
        >
          Выйти из аккаунта
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    padding: 24,
  },
  title: {
    marginTop: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
  error: {
    marginTop: 16,
    textAlign: 'center',
  },
  pinSection: {
    width: '100%',
    marginTop: 24,
  },
  pinInput: {
    marginBottom: 16,
  },
  button: {
    width: '100%',
  },
  biometricButton: {
    marginTop: 12,
  },
  logoutButton: {
    marginTop: 24,
  },
});
