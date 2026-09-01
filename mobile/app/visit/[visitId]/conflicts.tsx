import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/hooks/useAppTheme';
import CustomHeader from '../../../src/components/CustomHeader';
import { getDatabase } from '../../../src/db';
import { BOTTOM_PADDING_NESTED_SCREEN } from '../../../src/constants/layout';

interface ConflictItem {
  id: number;
  client_mutation_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  error: string;
  created_at: string;
  retry_count: number;
}

const ENTITY_LABELS: Record<string, string> = {
  visit: 'Визит',
  task: 'Задача',
  photo: 'Фото',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Создание',
  update: 'Обновление',
  delete: 'Удаление',
};

export default function ConflictsScreen() {
  const theme = useAppTheme();
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConflicts = useCallback(async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<ConflictItem>(
        `SELECT * FROM sync_queue WHERE error LIKE 'CONFLICT:%' ORDER BY created_at ASC`
      );
      setConflicts(rows);
    } catch (err) {
      console.error('Failed to fetch conflicts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const handleUseMyVersion = async (item: ConflictItem) => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        `UPDATE sync_queue SET status = 'pending', retry_count = 0, error = NULL WHERE id = ?`,
        [item.id]
      );
      await fetchConflicts();
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось обновить запись');
    }
  };

  const handleUseServerVersion = async (item: ConflictItem) => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        `UPDATE sync_queue SET status = 'completed' WHERE id = ?`,
        [item.id]
      );
      await fetchConflicts();
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось обновить запись');
    }
  };

  const handleMerge = async (item: ConflictItem): Promise<void> => {
    // Same as handleUseMyVersion
    await handleUseMyVersion(item);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <CustomHeader title="Конфликты" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>
            Загрузка конфликтов...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <CustomHeader title="Конфликты" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: BOTTOM_PADDING_NESTED_SCREEN }]}
      >
        {conflicts.length === 0 ? (
          <Surface style={[styles.emptyCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} elevation={0}>
            <MaterialCommunityIcons name="check-circle-outline" size={48} color={theme.colors.success} />
            <Text variant="bodyLarge" style={[styles.emptyTitle, { color: theme.colors.text }]}>
              Нет конфликтов
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.placeholder }]}>
              Все данные синхронизированы
            </Text>
          </Surface>
        ) : (
          conflicts.map((item) => (
            <Surface
              key={item.id}
              style={[styles.conflictCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              elevation={0}
            >
              <View style={styles.conflictHeader}>
                <View style={[styles.entityBadge, { backgroundColor: `${theme.colors.error}15` }]}>
                  <MaterialCommunityIcons
                    name={item.entity_type === 'visit' ? 'clipboard-text' : item.entity_type === 'task' ? 'wrench' : 'camera'}
                    size={16}
                    color={theme.colors.error}
                  />
                  <Text style={[styles.entityText, { color: theme.colors.error }]}>
                    {ENTITY_LABELS[item.entity_type] || item.entity_type}
                  </Text>
                </View>
                <View style={[styles.actionBadge, { backgroundColor: `${theme.colors.secondary}15` }]}>
                  <Text style={[styles.actionText, { color: theme.colors.secondary }]}>
                    {ACTION_LABELS[item.action] || item.action}
                  </Text>
                </View>
              </View>

              <View style={styles.conflictMeta}>
                <Text variant="bodySmall" style={[styles.metaLabel, { color: theme.colors.placeholder }]}>
                  ID сущности:
                </Text>
                <Text variant="bodySmall" style={[styles.metaValue, { color: theme.colors.text }]}>
                  {item.entity_id}
                </Text>
              </View>

              <View style={styles.conflictMeta}>
                <Text variant="bodySmall" style={[styles.metaLabel, { color: theme.colors.placeholder }]}>
                  Ошибка:
                </Text>
                <Text variant="bodySmall" style={[styles.metaValue, { color: theme.colors.error }]} numberOfLines={3}>
                  {item.error.replace('CONFLICT: ', '')}
                </Text>
              </View>

              <View style={styles.conflictMeta}>
                <Text variant="bodySmall" style={[styles.metaLabel, { color: theme.colors.placeholder }]}>
                  Создано:
                </Text>
                <Text variant="bodySmall" style={[styles.metaValue, { color: theme.colors.text }]}>
                  {new Date(item.created_at).toLocaleString('ru-RU')}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <Button
                  mode="contained"
                  onPress={() => handleUseMyVersion(item)}
                  compact
                  style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                  contentStyle={{ height: 36 }}
                  labelStyle={styles.actionButtonLabel}
                >
                  Моя версия
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => handleUseServerVersion(item)}
                  compact
                  style={[styles.actionButton, { borderColor: theme.colors.secondary }]}
                  contentStyle={{ height: 36 }}
                  textColor={theme.colors.secondary}
                >
                  Серверная версия
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => handleMerge(item)}
                  compact
                  style={[styles.actionButton, { borderColor: theme.colors.success }]}
                  contentStyle={{ height: 36 }}
                  textColor={theme.colors.success}
                >
                  Объединить
                </Button>
              </View>
            </Surface>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12 },
  emptyCard: { padding: 32, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  emptyTitle: { fontWeight: '600', marginTop: 12 },
  emptyText: { marginTop: 4, textAlign: 'center' },
  conflictCard: { padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  conflictHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  entityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  entityText: { fontSize: 12, fontWeight: '600' },
  actionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actionText: { fontSize: 12, fontWeight: '600' },
  conflictMeta: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  metaLabel: { fontSize: 12, fontWeight: '500', minWidth: 80 },
  metaValue: { fontSize: 12, flex: 1 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionButton: { flex: 1, minWidth: 100 },
  actionButtonLabel: { fontSize: 11 },
});
