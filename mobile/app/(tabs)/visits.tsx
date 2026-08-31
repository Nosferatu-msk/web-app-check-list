import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function VisitsScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Мои визиты</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Список визитов будет здесь
      </Text>
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
  subtitle: {
    marginTop: 8,
    color: '#64748B',
  },
});
