import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function BiometricSetupScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Настройка биометрии
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Используйте отпечаток пальца или Face Unlock для быстрого входа
      </Text>
      <Button mode="contained" onPress={() => router.replace('/(tabs)/visits')} style={styles.button}>
        Настроить
      </Button>
      <Button mode="text" onPress={() => router.replace('/(tabs)/visits')}>
        Пропустить
      </Button>
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
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 32,
    textAlign: 'center',
    opacity: 0.6,
  },
  button: {
    marginBottom: 12,
    paddingHorizontal: 32,
  },
});
