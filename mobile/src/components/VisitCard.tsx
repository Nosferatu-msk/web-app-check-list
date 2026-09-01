import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Visit } from '../types';
import { VISIT_STATUS_COLORS, VISIT_STATUS_LABELS } from '../utils/equipmentIcons';

interface VisitCardProps {
  visit: Visit;
}

export default function VisitCard({ visit }: VisitCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const statusColor = VISIT_STATUS_COLORS[visit.status] || '#64748B';
  const statusLabel = VISIT_STATUS_LABELS[visit.status] || visit.status;
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
          <Text variant="titleMedium" style={[styles.address, { color: theme.colors.onSurface }]} numberOfLines={2}>
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
                <MaterialCommunityIcons name="file-document-outline" size={11} color="#7C3AED" />
                <Text style={[styles.badgeText, { color: '#7C3AED' }]}>
                  Заявка №{visit.request_number}
                </Text>
              </View>
            )}
            {visit.contract_number && (
              <View style={[styles.badge, { backgroundColor: 'rgba(3,105,161,0.08)' }]}>
                <MaterialCommunityIcons name="file-sign" size={11} color="#0369A1" />
                <Text style={[styles.badgeText, { color: '#0369A1' }]}>
                  {visit.contract_number}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="calendar" size={13} color="#94A3B8" />
            <Text variant="bodySmall" style={styles.metaText}>
              {new Date(visit.date).toLocaleDateString('ru-RU')}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="clock-outline" size={13} color="#94A3B8" />
            <Text variant="bodySmall" style={styles.metaText}>
              {visit.time_start}
            </Text>
          </View>
          {visit.season && (
            <View style={[styles.seasonChip, {
              backgroundColor: visit.season === 'summer' ? '#FEF3C7' : '#DBEAFE',
            }]}>
              <MaterialCommunityIcons
                name={visit.season === 'summer' ? 'weather-sunny' : 'weather-snowy'}
                size={11}
                color={visit.season === 'summer' ? '#D97706' : '#0369A1'}
              />
              <Text style={[styles.seasonText, {
                color: visit.season === 'summer' ? '#D97706' : '#0369A1',
              }]}>
                {visit.season === 'summer' ? 'Лето' : 'Зима'}
              </Text>
            </View>
          )}
        </View>

        {visit.tasks_count ? (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${progress * 100}%`,
                backgroundColor: progress === 1 ? '#059669' : statusColor,
              }]} />
            </View>
            <View style={styles.progressInfo}>
              <MaterialCommunityIcons name="cog-outline" size={12} color="#94A3B8" />
              <Text variant="bodySmall" style={styles.progressText}>
                {visit.completed_tasks_count} / {visit.tasks_count} задач
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noTasks}>
            <MaterialCommunityIcons name="package-variant" size={12} color="#94A3B8" />
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
  address: {
    flex: 1,
    marginRight: 8,
    fontWeight: '600',
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  seasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  seasonText: {
    fontSize: 10,
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
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  noTasks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  noTasksText: {
    color: '#94A3B8',
    fontSize: 11,
  },
});
