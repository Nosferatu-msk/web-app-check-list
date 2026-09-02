import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
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
import PinPad from '../../src/components/PinPad';

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
    } catch {
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

  const handlePinDigitPress = async (digit: string) => {
    setError('');
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length >= 4) {
      setLoading(true);
      const valid = await verifyPinCode(newPin);
      if (valid) {
        await handleUnlock();
      } else {
        setError('Неверный PIN-код');
        setPin('');
      }
      setLoading(false);
    }
  };

  const handlePinDeletePress = () => {
    setError('');
    setPin(pin.slice(0, -1));
  };

  const handleLogout = async () => {
    const logout = useAuthStore.getState().logout;
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="lock" size={64} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Чек-лист инженера
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
          Приложение заблокировано
        </Text>

        {error ? (
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
        ) : null}

        {showPinInput ? (
          <PinPad
            pin={pin}
            maxLength={6}
            onDigitPress={handlePinDigitPress}
            onDeletePress={handlePinDeletePress}
          />
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
              contentStyle={{ height: 48 }}
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

        {loading && (
          <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>Проверка...</Text>
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
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    width: '100%',
  },
  biometricButton: {
    marginTop: 12,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 16,
  },
  logoutButton: {
    marginTop: 24,
  },
});
