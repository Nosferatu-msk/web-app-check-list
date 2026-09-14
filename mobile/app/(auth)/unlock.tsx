import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function UnlockScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Разблокировка</Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Используйте биометрию или PIN-код
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
