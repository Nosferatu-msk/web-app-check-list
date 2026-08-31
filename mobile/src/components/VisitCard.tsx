import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Visit } from '../types';

interface VisitCardProps {
  visit: Visit;
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  not_started: { label: 'Не начат', color: '#64748B', icon: 'clock-outline' },
  in_progress: { label: 'В работе', color: '#0369A1', icon: 'progress-wrench' },
  completed: { label: 'Завершён', color: '#059669', icon: 'check-circle' },
  sent: { label: 'Отправлен', color: '#0F766E', icon: 'email-check' },
  planned: { label: 'Запланирован', color: '#D97706', icon: 'calendar-clock' },
  sent_by_engineer: { label: 'Отпр. инженером', color: '#0F766E', icon: 'email-fast' },
  sent_by_tm: { label: 'Отпр. ТМ', color: '#7C3AED', icon: 'email-fast' },
  corrected_by_tm: { label: 'Исправлен ТМ', color: '#8B5CF6', icon: 'pencil-circle' },
  awaiting_assignment: { label: 'Ожидает', color: '#8B5CF6', icon: 'account-clock' },
};

export default function VisitCard({ visit }: VisitCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const config = statusConfig[visit.status] || statusConfig.not_started;
  const progress = visit.tasks_count
    ? (visit.completed_tasks_count || 0) / visit.tasks_count
    : 0;

  const handlePress = () => {
    router.push(`/visit/${visit.id}`);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="titleMedium" style={[styles.address, { color: theme.colors.onSurface }]} numberOfLines={2}>
              {visit.address}
            </Text>
            <View style={styles.dateRow}>
              <MaterialCommunityIcons name="calendar" size={14} color="#94A3B8" />
              <Text variant="bodySmall" style={styles.dateText}>
                {new Date(visit.date).toLocaleDateString('ru-RU')}
              </Text>
              <MaterialCommunityIcons name="clock-outline" size={14} color="#94A3B8" />
              <Text variant="bodySmall" style={styles.dateText}>
                {visit.time_start}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
            <MaterialCommunityIcons name={config.icon as any} size={12} color="#FFFFFF" />
            <Text style={styles.statusText}>{config.label}</Text>
          </View>
        </View>

        {visit.tasks_count ? (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${progress * 100}%`,
                backgroundColor: progress === 1 ? '#059669' : '#0369A1',
              }]} />
            </View>
            <View style={styles.progressInfo}>
              <MaterialCommunityIcons name="cog" size={14} color="#94A3B8" />
              <Text variant="bodySmall" style={styles.progressText}>
                {visit.completed_tasks_count} / {visit.tasks_count} задач
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noTasks}>
            <MaterialCommunityIcons name="package-variant" size={14} color="#94A3B8" />
            <Text variant="bodySmall" style={styles.noTasksText}>Нет задач</Text>
          </View>
        )}
      </Surface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 14,
    borderRadius: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  address: {
    fontWeight: '600',
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    color: '#94A3B8',
    marginRight: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  progressSection: {
    marginTop: 10,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    color: '#94A3B8',
  },
  noTasks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  noTasksText: {
    color: '#94A3B8',
  },
});
