import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useAuthStore } from '../../src/stores/authStore';

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Профиль
      </Text>
      {user && (
        <View style={styles.card}>
          <Text variant="titleLarge">{user.fullName || user.email}</Text>
          <Text variant="bodyMedium" style={styles.email}>
            {user.email}
          </Text>
          <Text variant="bodySmall" style={styles.role}>
            Роль: {user.role}
          </Text>
        </View>
      )}
      <Button mode="outlined" onPress={logout} style={styles.button}>
        Выйти
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  email: {
    marginTop: 8,
    opacity: 0.7,
  },
  role: {
    marginTop: 4,
    opacity: 0.5,
  },
  button: {
    marginTop: 'auto',
  },
});
