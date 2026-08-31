import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  isBiometricAvailable,
  authenticateWithBiometric,
  isBiometricEnabled,
  isPinSet,
  verifyPinCode,
} from '../../src/utils/biometric';
import { useAuthStore } from '../../src/stores/authStore';

export default function UnlockScreen() {
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
    <View style={styles.container}>
      <View style={styles.card}>
        <Icon name="lock" size={64} color="#0F766E" />
        <Text variant="headlineMedium" style={styles.title}>
          Чек-лист инженера
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Приложение заблокировано
        </Text>

        {error ? (
          <Text variant="bodyMedium" style={styles.error}>
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
              style={styles.button}
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
              style={styles.button}
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
    backgroundColor: '#F8FAFC',
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
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: '#64748B',
    textAlign: 'center',
  },
  error: {
    color: '#DC2626',
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
    backgroundColor: '#0F766E',
    width: '100%',
  },
  biometricButton: {
    marginTop: 12,
  },
  logoutButton: {
    marginTop: 24,
    color: '#64748B',
  },
});
