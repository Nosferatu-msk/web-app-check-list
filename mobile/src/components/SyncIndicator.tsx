import { View, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useSyncStore } from '../sync/engine';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function SyncIndicator() {
  const status = useSyncStore((state) => state.status);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const error = useSyncStore((state) => state.error);
  const sync = useSyncStore((state) => state.sync);

  if (pendingCount === 0 && status === 'idle') {
    return (
      <View style={styles.container}>
        <Icon name="check-circle" size={16} color="#059669" />
        <Text style={styles.synced}>Синхронизировано</Text>
      </View>
    );
  }

  if (status === 'syncing') {
    return (
      <View style={styles.container}>
        <Icon name="sync" size={16} color="#0369A1" />
        <Text style={styles.syncing}>Синхронизация...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.error]}>
        <Icon name="alert-circle" size={16} color="#DC2626" />
        <Text style={styles.errorText}>Ошибка синхронизации</Text>
        <IconButton icon="refresh" size={16} onPress={sync} />
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.pending]}>
      <Icon name="cloud-upload" size={16} color="#D97706" />
      <Text style={styles.pendingText}>
        {pendingCount} {pendingCount === 1 ? 'изменение' : 'изменений'}
      </Text>
      <IconButton icon="sync" size={16} onPress={sync} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  synced: {
    fontSize: 12,
    color: '#059669',
  },
  syncing: {
    fontSize: 12,
    color: '#0369A1',
  },
  pending: {
    backgroundColor: '#FEF3C7',
  },
  pendingText: {
    fontSize: 12,
    color: '#D97706',
  },
  error: {
    backgroundColor: '#FEE2E2',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
  },
});
