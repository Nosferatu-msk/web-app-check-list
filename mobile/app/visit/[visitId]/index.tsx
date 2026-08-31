import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Surface, Chip, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVisit } from '../../../src/api/queries';
import { Task } from '../../../src/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const statusLabels: Record<string, string> = {
  not_started: 'Не начат',
  in_progress: 'В работе',
  completed: 'Завершён',
  planned: 'Запланирован',
  sent: 'Отправлен',
  awaiting_assignment: 'Ожидает назначения',
};

const statusColors: Record<string, string> = {
  not_started: '#64748B',
  in_progress: '#0369A1',
  completed: '#059669',
  planned: '#D97706',
  sent: '#0F766E',
  awaiting_assignment: '#8B5CF6',
};

const statusIcons: Record<string, string> = {
  not_started: 'clock-outline',
  in_progress: 'progress-wrench',
  completed: 'check-circle',
  planned: 'calendar-clock',
  sent: 'email-check',
  awaiting_assignment: 'account-clock',
};

export default function VisitDetailScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const router = useRouter();
  const { data: visit, isLoading, error } = useVisit(visitId);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Загрузка визита...</Text>
      </View>
    );
  }

  if (error || !visit) {
    return (
      <View style={styles.loading}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#DC2626" />
        <Text style={styles.loadingText}>Не удалось загрузить визит</Text>
        <Button mode="outlined" onPress={() => router.back()} icon="arrow-left">
          Назад
        </Button>
      </View>
    );
  }

  const handleTaskPress = (task: Task) => {
    router.push(`/visit/${visitId}/task/${task.id}`);
  };

  const completedCount = visit.tasks?.filter(t => t.status === 'completed').length || 0;
  const totalCount = visit.tasks?.length || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Surface style={styles.card} elevation={2}>
        <View style={styles.cardHeader}>
          <Text variant="titleLarge" style={styles.address} numberOfLines={2}>
            {visit.address}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[visit.status] || '#64748B' }]}>
            <MaterialCommunityIcons
              name={(statusIcons[visit.status] || 'help-circle') as any}
              size={14}
              color="#FFFFFF"
            />
            <Text style={styles.statusText}>
              {statusLabels[visit.status] || visit.status}
            </Text>
          </View>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="calendar" size={16} color="#64748B" />
            <Text variant="bodyMedium" style={styles.metaText}>
              {new Date(visit.date).toLocaleDateString('ru-RU')}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#64748B" />
            <Text variant="bodyMedium" style={styles.metaText}>
              {visit.time_start}
            </Text>
          </View>
          <Chip
            style={[styles.seasonChip, {
              backgroundColor: visit.season === 'summer' ? '#FEF3C7' : '#DBEAFE',
            }]}
            textStyle={{ fontSize: 12 }}
            icon={visit.season === 'summer' ? 'weather-sunny' : 'weather-snowy'}
          >
            {visit.season === 'summer' ? 'Лето' : 'Зима'}
          </Chip>
        </View>

        {visit.engineer_name && (
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="account-hard-hat" size={16} color="#64748B" />
            <Text variant="bodyMedium" style={styles.engineer}>
              {visit.engineer_name}
            </Text>
          </View>
        )}

        {totalCount > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${(completedCount / totalCount) * 100}%`,
                backgroundColor: completedCount === totalCount ? '#059669' : '#0369A1',
              }]} />
            </View>
            <Text variant="bodySmall" style={styles.progressText}>
              {completedCount} из {totalCount} задач выполнено
            </Text>
          </View>
        )}
      </Surface>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Задачи ({totalCount})
        </Text>

        {totalCount > 0 ? (
          visit.tasks!.map((task) => (
            <TouchableOpacity key={task.id} onPress={() => handleTaskPress(task)} activeOpacity={0.7}>
              <Surface style={styles.taskCard} elevation={0}>
                <View style={styles.taskHeader}>
                  <View style={styles.taskIconContainer}>
                    <MaterialCommunityIcons
                      name="cog"
                      size={20}
                      color={statusColors[task.status] || '#64748B'}
                    />
                  </View>
                  <View style={styles.taskContent}>
                    <Text variant="bodyMedium" style={styles.taskName}>
                      {task.equipment_type_name || 'Оборудование'}
                    </Text>
                    {task.room_type_name && (
                      <Text variant="bodySmall" style={styles.taskRoom}>
                        {task.room_type_name}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.taskStatus, { backgroundColor: statusColors[task.status] || '#64748B' }]}>
                    <Text style={styles.taskStatusText}>
                      {statusLabels[task.status] || task.status}
                    </Text>
                  </View>
                </View>
              </Surface>
            </TouchableOpacity>
          ))
        ) : (
          <Surface style={styles.emptyCard} elevation={0}>
            <MaterialCommunityIcons name="package-variant" size={48} color="#94A3B8" />
            <Text variant="bodyLarge" style={styles.emptyTitle}>
              Нет задач
            </Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Добавьте оборудование для начала работы
            </Text>
          </Surface>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => router.push(`/visit/${visitId}/add-equipment`)}
          icon="plus"
          style={styles.addButton}
          contentStyle={{ height: 48 }}
        >
          Добавить оборудование
        </Button>

        {visit.status !== 'completed' && (
          <Button
            mode="contained"
            onPress={() => {}} // TODO: завершение визита
            icon="check"
            style={styles.completeButton}
            contentStyle={{ height: 48 }}
          >
            Завершить визит
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#64748B', marginTop: 12, marginBottom: 16, textAlign: 'center' },
  card: { padding: 16, borderRadius: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  address: { flex: 1, fontWeight: '700', color: '#0F172A', marginRight: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4 },
  statusText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#64748B' },
  seasonChip: { height: 28 },
  engineer: { color: '#64748B' },
  progressSection: { marginTop: 12 },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { color: '#64748B', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontWeight: '600', color: '#0F172A', marginBottom: 12 },
  taskCard: { padding: 12, borderRadius: 12, marginBottom: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  taskHeader: { flexDirection: 'row', alignItems: 'center' },
  taskIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  taskContent: { flex: 1 },
  taskName: { fontWeight: '500', color: '#0F172A' },
  taskRoom: { color: '#64748B', marginTop: 2 },
  taskStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  taskStatusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  emptyCard: { padding: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTitle: { color: '#0F172A', fontWeight: '600', marginTop: 12 },
  emptyText: { color: '#64748B', marginTop: 4, textAlign: 'center' },
  emptyTasks: { color: '#64748B', textAlign: 'center', padding: 24 },
  actions: { gap: 12, paddingBottom: 24 },
  addButton: { borderColor: '#0F766E' },
  completeButton: { backgroundColor: '#059669' },
});
