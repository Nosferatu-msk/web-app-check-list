import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSyncStore } from '../../src/sync/engine';
import { Task } from '../../src/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getEquipmentIcon } from '../../src/utils/equipmentIcons';
import { VISIT_STATUS_COLORS, VISIT_STATUS_LABELS } from '../../src/utils/equipmentIcons';
import { STATUS_BAR_HEIGHT, BOTTOM_PADDING_NESTED_SCREEN } from '../../src/constants/layout';
import api from '../../src/api/client';

function useMtrVisit(visitId: string) {
  return useQuery({
    queryKey: ['mtr-visit', visitId],
    queryFn: async () => {
      const response = await api.get(`/mtr/visits/${visitId}`);
      return response.data;
    },
    enabled: !!visitId,
  });
}

function useUpdateMtrVisitStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, status }: { visitId: string; status: string }) => {
      const response = await api.patch(`/mtr/visits/${visitId}`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mtr-visits'] });
      queryClient.invalidateQueries({ queryKey: ['mtr-visit'] });
    },
  });
}

function useDeleteMtrVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (visitId: string) => {
      await api.delete(`/mtr/visits/${visitId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mtr-visits'] });
    },
  });
}

export default function MtrVisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: visit, isLoading, error } = useMtrVisit(id!);
  const updateStatus = useUpdateMtrVisitStatus();
  const deleteVisit = useDeleteMtrVisit();
  const syncStatus = useSyncStore((state) => state.status);
  const syncError = useSyncStore((state) => state.error);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const theme = useAppTheme();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Загрузка визита МТР...</Text>
      </View>
    );
  }

  if (error || !visit) {
    return (
      <View style={styles.loading}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <Text style={styles.loadingText}>Не удалось загрузить визит МТР</Text>
        <Button mode="outlined" onPress={() => router.back()} icon="arrow-left">
          Назад
        </Button>
      </View>
    );
  }

  const handleTaskPress = (task: Task) => {
    router.push(`/mtr/${id}/task/${task.id}`);
  };

  const handleCompleteVisit = async () => {
    await updateStatus.mutateAsync({ visitId: id!, status: 'completed' });
    router.back();
  };

  const handleDeleteVisit = () => {
    Alert.alert(
      'Удалить визит МТР?',
      'Это действие нельзя отменить. Все данные визита будут удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            await deleteVisit.mutateAsync(id!);
            router.back();
          },
        },
      ]
    );
  };

  const completedCount = visit.tasks?.filter((t: Task) => t.status === 'completed').length || 0;
  const totalCount = visit.tasks?.length || 0;
  const statusColor = VISIT_STATUS_COLORS[visit.status] || theme.colors.placeholder;
  const statusLabel = VISIT_STATUS_LABELS[visit.status] || visit.status;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        elevation={2}
      >
        <View style={styles.cardHeader}>
          <Text
            variant="titleLarge"
            style={[styles.address, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {visit.address}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="calendar" size={15} color={theme.colors.placeholder} />
            <Text
              variant="bodySmall"
              style={[styles.metaText, { color: theme.colors.placeholder }]}
            >
              {new Date(visit.date).toLocaleDateString('ru-RU')}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={15}
              color={theme.colors.placeholder}
            />
            <Text
              variant="bodySmall"
              style={[styles.metaText, { color: theme.colors.placeholder }]}
            >
              {visit.time_start}
            </Text>
          </View>
        </View>

        {visit.engineer_name && (
          <View style={styles.metaItem}>
            <MaterialCommunityIcons
              name="account-hard-hat"
              size={15}
              color={theme.colors.placeholder}
            />
            <Text
              variant="bodySmall"
              style={[styles.metaText, { color: theme.colors.placeholder }]}
            >
              {visit.engineer_name}
            </Text>
          </View>
        )}

        {totalCount > 0 && (
          <View style={styles.progressSection}>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(completedCount / totalCount) * 100}%`,
                    backgroundColor: completedCount === totalCount ? '#059669' : '#0369A1',
                  },
                ]}
              />
            </View>
            <Text
              variant="bodySmall"
              style={[styles.progressText, { color: theme.colors.placeholder }]}
            >
              {completedCount} из {totalCount} задач выполнено
            </Text>
          </View>
        )}
      </Surface>

      {/* Индикатор синхронизации */}
      <View style={styles.syncRow}>
        <MaterialCommunityIcons
          name={
            syncStatus === 'syncing'
              ? 'sync'
              : syncError
                ? 'alert-circle'
                : pendingCount > 0
                  ? 'cloud-upload'
                  : 'check-circle'
          }
          size={14}
          color={
            syncStatus === 'syncing'
              ? '#0369A1'
              : syncError
                ? '#DC2626'
                : pendingCount > 0
                  ? '#D97706'
                  : '#059669'
          }
        />
        <Text
          style={[
            styles.syncText,
            {
              color:
                syncStatus === 'syncing'
                  ? '#0369A1'
                  : syncError
                    ? '#DC2626'
                    : pendingCount > 0
                      ? '#D97706'
                      : '#059669',
            },
          ]}
        >
          {syncStatus === 'syncing'
            ? 'Синхронизация...'
            : syncError
              ? 'Ошибка синхронизации'
              : pendingCount > 0
                ? `${pendingCount} не отправлено`
                : 'Синхронизировано'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Задачи ({totalCount})
        </Text>

        {totalCount > 0 ? (
          visit.tasks!.map((task: Task) => {
            const eqIcon = getEquipmentIcon(task.equipment_type_code);
            const taskStatusColor =
              task.status === 'completed'
                ? '#059669'
                : task.status === 'in_progress'
                  ? '#0369A1'
                  : '#64748B';
            const taskStatusLabel =
              task.status === 'completed'
                ? 'Завершён'
                : task.status === 'in_progress'
                  ? 'В работе'
                  : 'Не начат';

            return (
              <TouchableOpacity key={task.id} onPress={() => handleTaskPress(task)} activeOpacity={0.7}>
                <Surface
                  style={[
                    styles.taskCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                  elevation={0}
                >
                  <View style={styles.taskHeader}>
                    <View
                      style={[
                        styles.taskIconContainer,
                        { backgroundColor: `${taskStatusColor}15` },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={eqIcon as any}
                        size={20}
                        color={taskStatusColor}
                      />
                    </View>
                    <View style={styles.taskContent}>
                      <Text
                        variant="bodyMedium"
                        style={[styles.taskName, { color: theme.colors.text }]}
                      >
                        {task.equipment_type_name || task.equipment_type_code}
                      </Text>
                      {task.room_type_name && (
                        <Text
                          variant="bodySmall"
                          style={[styles.taskRoom, { color: theme.colors.placeholder }]}
                        >
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
          <Surface
            style={[
              styles.emptyCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
            elevation={0}
          >
            <MaterialCommunityIcons name="package-variant" size={48} color={theme.colors.placeholder} />
            <Text variant="bodyLarge" style={[styles.emptyTitle, { color: theme.colors.text }]}>
              Нет задач
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.emptyText, { color: theme.colors.placeholder }]}
            >
              Добавьте оборудование для начала работы
            </Text>
          </Surface>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => router.push(`/mtr/${id}/add-equipment`)}
          icon="plus"
          style={[styles.addButton, { borderColor: theme.colors.primary }]}
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
            style={[styles.completeButton, { backgroundColor: theme.colors.success }]}
            contentStyle={{ height: 48 }}
          >
            Завершить визит
          </Button>
        )}

        {visit.status === 'completed' && (
          <Button
            mode="contained"
            onPress={() => router.push(`/mtr/${id}/report`)}
            icon="file-pdf-box"
            style={[styles.reportButton, { backgroundColor: theme.colors.secondary }]}
            contentStyle={{ height: 48 }}
          >
            Сформировать отчёт
          </Button>
        )}

        <Button
          mode="outlined"
          onPress={handleDeleteVisit}
          loading={deleteVisit.isPending}
          icon="delete-outline"
          style={[styles.deleteButton, { borderColor: theme.colors.error }]}
          contentStyle={{ height: 48 }}
          textColor={theme.colors.error}
        >
          Удалить визит МТР
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 16,
    paddingTop: STATUS_BAR_HEIGHT + 16,
    paddingBottom: BOTTOM_PADDING_NESTED_SCREEN,
  },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, marginBottom: 16, textAlign: 'center' },
  card: { padding: 16, borderRadius: 16, marginBottom: 16 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  address: { flex: 1, fontWeight: '700', marginRight: 8, lineHeight: 22 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { color: '#FFFFFF', fontWeight: '600', fontSize: 11 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  progressSection: { marginTop: 10 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { marginTop: 4, fontSize: 12 },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  syncText: { fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 16 },
  sectionTitle: { fontWeight: '600', marginBottom: 12 },
  taskCard: { padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1 },
  taskHeader: { flexDirection: 'row', alignItems: 'center' },
  taskIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskContent: { flex: 1 },
  taskName: { fontWeight: '500', fontSize: 14 },
  taskRoom: { marginTop: 2, fontSize: 12 },
  taskStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  taskStatusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  emptyCard: { padding: 32, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  emptyTitle: { fontWeight: '600', marginTop: 12 },
  emptyText: { marginTop: 4, textAlign: 'center' },
  actions: { gap: 12, paddingBottom: 24 },
  addButton: {},
  completeButton: {},
  reportButton: {},
  deleteButton: {},
});
