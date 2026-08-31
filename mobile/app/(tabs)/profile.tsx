import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useAuthStore } from '../../src/stores/authStore';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Профиль</Text>
      {user && (
        <>
          <Text variant="titleMedium" style={styles.name}>
            {user.fullName}
          </Text>
          <Text variant="bodyMedium" style={styles.email}>
            {user.email}
          </Text>
          <Text variant="bodySmall" style={styles.role}>
            {user.role}
          </Text>
        </>
      )}
      <Button mode="contained" onPress={logout} style={styles.logoutButton}>
        Выйти
      </Button>
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
  name: {
    marginTop: 16,
  },
  email: {
    marginTop: 4,
    color: '#64748B',
  },
  role: {
    marginTop: 4,
    color: '#0F766E',
    textTransform: 'uppercase',
  },
  logoutButton: {
    marginTop: 32,
  },
});
