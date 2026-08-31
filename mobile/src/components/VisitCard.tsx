import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Surface, Text, ProgressBar, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Visit } from '../types';

interface VisitCardProps {
  visit: Visit;
}

const statusLabels: Record<string, string> = {
  not_started: 'Не начат',
  in_progress: 'В работе',
  completed: 'Завершён',
  sent: 'Отправлен',
  planned: 'Запланирован',
};

const statusColors: Record<string, string> = {
  not_started: '#64748B',
  in_progress: '#0369A1',
  completed: '#059669',
  sent: '#0F766E',
  planned: '#D97706',
};

export default function VisitCard({ visit }: VisitCardProps) {
  const router = useRouter();
  const theme = useTheme();

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
          <Text variant="titleMedium" style={[styles.address, { color: theme.colors.text }]} numberOfLines={2}>
            {visit.address}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[visit.status] }]}>
            <Text style={styles.statusText}>{statusLabels[visit.status]}</Text>
          </View>
        </View>

        <View style={styles.meta}>
          <Text variant="bodySmall" style={{ color: theme.colors.placeholder }}>
            {new Date(visit.date).toLocaleDateString('ru-RU')} • {visit.time_start}
          </Text>
        </View>

        {visit.tasks_count ? (
          <View style={styles.progress}>
            <ProgressBar
              progress={progress}
              color={statusColors[visit.status]}
              style={styles.progressBar}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.placeholder }}>
              {visit.completed_tasks_count} / {visit.tasks_count} задач
            </Text>
          </View>
        ) : null}
      </Surface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  address: {
    flex: 1,
    marginRight: 8,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    marginTop: 8,
  },
  progress: {
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
});
