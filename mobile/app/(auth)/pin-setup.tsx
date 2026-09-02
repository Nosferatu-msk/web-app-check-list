import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { setPinCode } from '../../src/utils/biometric';
import PinPad from '../../src/components/PinPad';

export default function PinSetupScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDigitPress = (digit: string) => {
    setError('');
    if (step === 'enter') {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => setStep('confirm'), 200);
      }
    } else {
      const newConfirm = confirmPin + digit;
      setConfirmPin(newConfirm);
      if (newConfirm.length === pin.length) {
        setTimeout(() => handleCheck(newConfirm), 200);
      }
    }
  };

  const handleDeletePress = () => {
    setError('');
    if (step === 'enter') {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const handleCheck = async (confirm: string) => {
    if (confirm !== pin) {
      setError('PIN-коды не совпадают. Попробуйте снова.');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      await setPinCode(pin);
      router.back();
    } catch {
      setError('Ошибка сохранения PIN');
      setConfirmPin('');
    } finally {
      setLoading(false);
    }
  };

  const currentPin = step === 'enter' ? pin : confirmPin;
  const title = step === 'enter' ? 'Установка PIN-кода' : 'Повторите PIN-код';
  const subtitle = step === 'enter'
    ? 'PIN-код используется для разблокировки приложения, если биометрия недоступна'
    : 'Введите PIN-код ещё раз для подтверждения';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.primary}10` }]}>
          <MaterialCommunityIcons name="lock" size={32} color={theme.colors.primary} />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>{subtitle}</Text>

        {error ? (
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
        ) : null}

        <PinPad
          pin={currentPin}
          maxLength={6}
          onDigitPress={handleDigitPress}
          onDeletePress={handleDeletePress}
        />

        {loading && (
          <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>Сохранение...</Text>
        )}

        <Button
          mode="text"
          onPress={() => router.back()}
          style={styles.cancelButton}
          textColor={theme.colors.placeholder}
        >
          Отмена
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
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 16,
  },
  cancelButton: {
    marginTop: 24,
  },
});
