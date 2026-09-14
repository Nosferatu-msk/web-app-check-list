import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function PinSetupScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Настройка PIN-кода</Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Скоро здесь будет ввод PIN-кода
      </Text>
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
  subtitle: {
    marginTop: 16,
    opacity: 0.6,
  },
});
