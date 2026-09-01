import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  isBiometricAvailable,
  enableBiometric,
} from '../../src/utils/biometric';

export default function BiometricSetupScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const bioAvailable = await isBiometricAvailable();
      setAvailable(bioAvailable);
      setLoading(false);
    })();
  }, []);

  const handleEnable = async () => {
    await enableBiometric();
    router.replace('/(tabs)/visits');
  };

  const handleSkip = () => {
    router.replace('/(tabs)/visits');
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>Проверка биометрии...</Text>
      </View>
    );
  }

  if (!available) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.content}>
          <MaterialCommunityIcons name="fingerprint" size={64} color={theme.colors.placeholder} />
          <Text style={[styles.title, { color: theme.colors.text }]}>Биометрия недоступна</Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            На этом устройстве не поддерживается вход по отпечатку или лицу.
            Вы можете установить PIN-код в профиле.
          </Text>
          <Button
            mode="contained"
            onPress={handleSkip}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            contentStyle={{ height: 48 }}
          >
            Продолжить
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Surface style={[styles.iconCard, { backgroundColor: `${theme.colors.primary}10` }]} elevation={2}>
          <MaterialCommunityIcons name="fingerprint" size={64} color={theme.colors.primary} />
        </Surface>

        <Text style={[styles.title, { color: theme.colors.text }]}>Вход по отпечатку или лицу</Text>
        <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
          Включите биометрию для быстрого и безопасного входа в приложение.
          Вам не придётся вводить пароль каждый раз.
        </Text>

        <Button
          mode="contained"
          onPress={handleEnable}
          icon="fingerprint"
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          contentStyle={{ height: 48 }}
        >
          Включить биометрию
        </Button>

        <Button
          mode="text"
          onPress={handleSkip}
          textColor={theme.colors.placeholder}
          style={styles.skipButton}
        >
          Пропустить
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
  },
  iconCard: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    width: '100%',
    borderRadius: 12,
  },
  skipButton: {
    marginTop: 12,
  },
  loadingText: {
    fontSize: 16,
  },
});
