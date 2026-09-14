import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function VisitsScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Мои визиты
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Скоро здесь будет список визитов
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
  },
});
