import { View, StyleSheet } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { useSyncStore } from '../sync/engine';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SyncIndicator() {
  const theme = useTheme();
  const status = useSyncStore((state) => state.status);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const error = useSyncStore((state) => state.error);
  const sync = useSyncStore((state) => state.sync);

  if (pendingCount === 0 && status === 'idle') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surfaceVariant }]}>
        <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.primary} />
        <Text style={[styles.text, { color: theme.colors.primary }]}>Синхронизировано</Text>
      </View>
    );
  }

  if (status === 'syncing') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surfaceVariant }]}>
        <MaterialCommunityIcons name="sync" size={16} color="#0369A1" />
        <Text style={[styles.text, { color: '#0369A1' }]}>Синхронизация...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: 'rgba(220,38,38,0.1)' }]}>
        <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
        <Text style={[styles.text, { color: '#DC2626' }]}>Ошибка</Text>
        <IconButton icon="refresh" size={16} onPress={sync} iconColor="#DC2626" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(217,119,6,0.1)' }]}>
      <MaterialCommunityIcons name="cloud-upload" size={16} color="#D97706" />
      <Text style={[styles.text, { color: '#D97706' }]}>
        {pendingCount}
      </Text>
      <IconButton icon="sync" size={16} onPress={sync} iconColor="#D97706" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});
