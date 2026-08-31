import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { setPinCode } from '../../src/utils/biometric';

export default function PinSetupScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (pin.length < 4) {
      setError('PIN должен быть не менее 4 цифр');
      return;
    }

    if (pin !== confirmPin) {
      setError('PIN-коды не совпадают');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await setPinCode(pin);
      router.back();
    } catch (err) {
      setError('Ошибка сохранения PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text variant="headlineMedium" style={styles.title}>
          Установка PIN-кода
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          PIN-код используется для разблокировки приложения, если биометрия недоступна
        </Text>

        {error ? (
          <Text variant="bodyMedium" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <TextInput
          label="PIN-код"
          value={pin}
          onChangeText={setPin}
          mode="outlined"
          secureTextEntry
          keyboardType="numeric"
          maxLength={6}
          style={styles.input}
        />

        <TextInput
          label="Повторите PIN-код"
          value={confirmPin}
          onChangeText={setConfirmPin}
          mode="outlined"
          secureTextEntry
          keyboardType="numeric"
          maxLength={6}
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          loading={loading}
          disabled={loading || !pin || !confirmPin}
          style={styles.button}
        >
          Сохранить
        </Button>

        <Button
          mode="text"
          onPress={() => router.back()}
          style={styles.cancelButton}
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
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: 24,
  },
  title: {
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  error: {
    color: '#DC2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#0F766E',
    marginTop: 8,
  },
  cancelButton: {
    marginTop: 12,
    color: '#64748B',
  },
});
