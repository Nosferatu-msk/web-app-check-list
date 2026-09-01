import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Surface, Chip, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVisit } from '../../../src/api/queries';
import { useUpdateVisitStatus } from '../../../src/api/queries';
import { Task } from '../../../src/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getEquipmentIcon } from '../../../src/utils/equipmentIcons';
import { VISIT_STATUS_COLORS, VISIT_STATUS_LABELS } from '../../../src/utils/equipmentIcons';

export default function VisitDetailScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const router = useRouter();
  const { data: visit, isLoading, error } = useVisit(visitId);
  const updateStatus = useUpdateVisitStatus();

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

  const handleCompleteVisit = async () => {
    await updateStatus.mutateAsync({ visitId, status: 'completed' });
    router.back();
  };

  const completedCount = visit.tasks?.filter(t => t.status === 'completed').length || 0;
  const totalCount = visit.tasks?.length || 0;
  const statusColor = VISIT_STATUS_COLORS[visit.status] || '#64748B';
  const statusLabel = VISIT_STATUS_LABELS[visit.status] || visit.status;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Surface style={styles.card} elevation={2}>
        <View style={styles.cardHeader}>
          <Text variant="titleLarge" style={styles.address} numberOfLines={2}>
            {visit.address}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        {(visit.request_number || visit.contract_number) && (
          <View style={styles.badges}>
            {visit.request_number && (
              <View style={[styles.badge, { backgroundColor: 'rgba(124,58,237,0.08)' }]}>
                <MaterialCommunityIcons name="file-document-outline" size={12} color="#7C3AED" />
                <Text style={[styles.badgeText, { color: '#7C3AED' }]}>
                  Заявка №{visit.request_number}
                </Text>
              </View>
            )}
            {visit.contract_number && (
              <View style={[styles.badge, { backgroundColor: 'rgba(3,105,161,0.08)' }]}>
                <MaterialCommunityIcons name="file-sign" size={12} color="#0369A1" />
                <Text style={[styles.badgeText, { color: '#0369A1' }]}>
                  {visit.contract_number}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="calendar" size={15} color="#64748B" />
            <Text variant="bodySmall" style={styles.metaText}>
              {new Date(visit.date).toLocaleDateString('ru-RU')}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="clock-outline" size={15} color="#64748B" />
            <Text variant="bodySmall" style={styles.metaText}>
              {visit.time_start}
            </Text>
          </View>
          <View style={[styles.seasonChip, {
            backgroundColor: visit.season === 'summer' ? '#FEF3C7' : '#DBEAFE',
          }]}>
            <MaterialCommunityIcons
              name={visit.season === 'summer' ? 'weather-sunny' : 'weather-snowy'}
              size={12}
              color={visit.season === 'summer' ? '#D97706' : '#0369A1'}
            />
            <Text style={[styles.seasonText, {
              color: visit.season === 'summer' ? '#D97706' : '#0369A1',
            }]}>
              {visit.season === 'summer' ? 'Лето' : 'Зима'}
            </Text>
          </View>
        </View>

        {visit.engineer_name && (
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="account-hard-hat" size={15} color="#64748B" />
            <Text variant="bodySmall" style={styles.metaText}>
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
          visit.tasks!.map((task) => {
            const eqIcon = getEquipmentIcon(task.equipment_type_code);
            const taskStatusColor = task.status === 'completed' ? '#059669'
              : task.status === 'in_progress' ? '#0369A1' : '#64748B';
            const taskStatusLabel = task.status === 'completed' ? 'Завершён'
              : task.status === 'in_progress' ? 'В работе' : 'Не начат';

            return (
              <TouchableOpacity key={task.id} onPress={() => handleTaskPress(task)} activeOpacity={0.7}>
                <Surface style={styles.taskCard} elevation={0}>
                  <View style={styles.taskHeader}>
                    <View style={[styles.taskIconContainer, { backgroundColor: `${taskStatusColor}15` }]}>
                      <MaterialCommunityIcons
                        name={eqIcon as any}
                        size={20}
                        color={taskStatusColor}
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
                    <View style={[styles.taskStatus, { backgroundColor: taskStatusColor }]}>
                      <Text style={styles.taskStatusText}>{taskStatusLabel}</Text>
                    </View>
                  </View>
                </Surface>
              </TouchableOpacity>
            );
          })
        ) : (
          <Surface style={styles.emptyCard} elevation={0}>
            <MaterialCommunityIcons name="package-variant" size={48} color="#94A3B8" />
            <Text variant="bodyLarge" style={styles.emptyTitle}>Нет задач</Text>
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
            onPress={handleCompleteVisit}
            loading={updateStatus.isPending}
            disabled={updateStatus.isPending}
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  address: { flex: 1, fontWeight: '700', color: '#0F172A', marginRight: 8, lineHeight: 22 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { color: '#FFFFFF', fontWeight: '600', fontSize: 11 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#64748B', fontSize: 12 },
  seasonChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  seasonText: { fontSize: 11, fontWeight: '600' },
  progressSection: { marginTop: 10 },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { color: '#64748B', marginTop: 4, fontSize: 12 },
  section: { marginBottom: 16 },
  sectionTitle: { fontWeight: '600', color: '#0F172A', marginBottom: 12 },
  taskCard: { padding: 12, borderRadius: 12, marginBottom: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  taskHeader: { flexDirection: 'row', alignItems: 'center' },
  taskIconContainer: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  taskContent: { flex: 1 },
  taskName: { fontWeight: '500', color: '#0F172A', fontSize: 14 },
  taskRoom: { color: '#64748B', marginTop: 2, fontSize: 12 },
  taskStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  taskStatusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  emptyCard: { padding: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTitle: { color: '#0F172A', fontWeight: '600', marginTop: 12 },
  emptyText: { color: '#64748B', marginTop: 4, textAlign: 'center' },
  actions: { gap: 12, paddingBottom: 24 },
  addButton: { borderColor: '#0F766E' },
  completeButton: { backgroundColor: '#059669' },
});
