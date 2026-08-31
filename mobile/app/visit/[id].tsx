import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Surface, Chip } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVisit } from '../../src/api/queries';
import { Task } from '../../src/types';

const statusLabels: Record<string, string> = {
  not_started: 'Не начато',
  in_progress: 'В работе',
  completed: 'Выполнено',
};

const statusColors: Record<string, string> = {
  not_started: '#64748B',
  in_progress: '#0369A1',
  completed: '#059669',
};

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: visit, isLoading } = useVisit(id);

  if (isLoading || !visit) {
    return (
      <View style={styles.container}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  const handleTaskPress = (task: Task) => {
    router.push(`/visit/${id}/task/${task.id}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleLarge" style={styles.address}>
          {visit.address}
        </Text>
        
        <View style={styles.meta}>
          <Text variant="bodyMedium" style={styles.metaText}>
            {new Date(visit.date).toLocaleDateString('ru-RU')} • {visit.time_start}
          </Text>
          <Chip 
            style={[styles.seasonChip, { 
              backgroundColor: visit.season === 'summer' ? '#FEF3C7' : '#DBEAFE' 
            }]}
            textStyle={{ fontSize: 12 }}
          >
            {visit.season === 'summer' ? 'Лето' : 'Зима'}
          </Chip>
        </View>

        {visit.engineer_name && (
          <Text variant="bodyMedium" style={styles.engineer}>
            Инженер: {visit.engineer_name}
          </Text>
        )}

        <View style={[styles.statusBadge, { backgroundColor: statusColors[visit.status] }]}>
          <Text style={styles.statusText}>{statusLabels[visit.status]}</Text>
        </View>
      </Surface>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Задачи ({visit.tasks?.length || 0})
        </Text>

        {visit.tasks && visit.tasks.length > 0 ? (
          visit.tasks.map((task) => (
            <TouchableOpacity key={task.id} onPress={() => handleTaskPress(task)} activeOpacity={0.7}>
              <Surface style={styles.taskCard} elevation={0}>
                <View style={styles.taskHeader}>
                  <Text variant="bodyMedium" style={styles.taskName}>
                    {task.equipment_type_name || 'Оборудование'}
                  </Text>
                  <View style={[styles.taskStatus, { backgroundColor: statusColors[task.status] }]}>
                    <Text style={styles.taskStatusText}>{statusLabels[task.status]}</Text>
                  </View>
                </View>
                {task.room_type_name && (
                  <Text variant="bodySmall" style={styles.taskRoom}>
                    {task.room_type_name}
                  </Text>
                )}
              </Surface>
            </TouchableOpacity>
          ))
        ) : (
          <Text variant="bodyMedium" style={styles.emptyTasks}>
            Нет задач. Добавьте оборудование.
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => router.push(`/visit/${id}/add-equipment`)}
          icon="plus"
          style={styles.addButton}
        >
          Добавить оборудование
        </Button>

        {visit.status !== 'completed' && (
          <Button
            mode="contained"
            onPress={() => {}} // TODO: завершение визита
            icon="check"
            style={styles.completeButton}
          >
            Завершить визит
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  address: {
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metaText: {
    color: '#64748B',
  },
  seasonChip: {
    height: 24,
  },
  engineer: {
    color: '#64748B',
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  taskCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskName: {
    flex: 1,
    fontWeight: '500',
  },
  taskStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  taskStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  taskRoom: {
    color: '#64748B',
    marginTop: 4,
  },
  emptyTasks: {
    color: '#64748B',
    textAlign: 'center',
    padding: 24,
  },
  actions: {
    gap: 12,
  },
  addButton: {
    borderColor: '#0F766E',
  },
  completeButton: {
    backgroundColor: '#059669',
  },
});
