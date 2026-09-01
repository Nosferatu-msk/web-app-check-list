import { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Button, SegmentedButtons, Surface } from 'react-native-paper';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getEquipmentIcon } from '../../src/utils/equipmentIcons';
import SyncIndicator from '../../src/components/SyncIndicator';
import NotificationBell from '../../src/components/NotificationBell';
import { STATUS_BAR_HEIGHT, BOTTOM_PADDING_TAB_SCREEN } from '../../src/constants/layout';
import api from '../../src/api/client';
import { useFocusEffect } from 'expo-router';

interface Request {
  id: string;
  number: string;
  address: string;
  equipment_type_name?: string;
  equipment_type_code?: string;
  execution_status: string;
  visit_id?: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

const STATUS_COLORS: Record<string, string> = {
  new: '#7C3AED',
  in_progress: '#0369A1',
  completed: '#059669',
  cancelled: '#64748B',
};

export default function RequestsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [tab, setTab] = useState<string>('all');
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const response = await api.get('/requests', { params: { status: tab === 'all' ? undefined : tab } });
      setRequests(response.data);
    } catch (e) {
      console.error('Error fetching requests:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [fetchRequests])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const getActionLabel = (req: Request) => {
    if (!req.visit_id) {
      return req.execution_status === 'new' ? 'Начать визит' : 'Продолжить визит';
    }
    return 'Просмотреть отчёт';
  };

  const handleAction = (req: Request) => {
    if (req.visit_id) {
      router.push(`/visit/${req.visit_id}`);
    } else {
      router.push('/visit/new');
    }
  };

  const renderRequest = ({ item }: { item: Request }) => {
    const statusColor = STATUS_COLORS[item.execution_status] || theme.colors.placeholder;
    const statusLabel = STATUS_LABELS[item.execution_status] || item.execution_status;

    return (
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.cardHeader}>
          <Text style={styles.requestNumber}>
            №{item.number}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={[styles.address, { color: theme.colors.text }]}>{item.address}</Text>
        {item.equipment_type_name && (
          <View style={styles.equipRow}>
            <MaterialCommunityIcons
              name={getEquipmentIcon(item.equipment_type_code) as any}
              size={14}
              color={theme.colors.placeholder}
            />
            <Text style={[styles.equipName, { color: theme.colors.placeholder }]}>{item.equipment_type_name}</Text>
          </View>
        )}
        <Button
          mode={item.visit_id ? 'outlined' : 'contained'}
          onPress={() => handleAction(item)}
          compact
          style={[styles.actionButton, { borderColor: theme.colors.primary }]}
          contentStyle={{ height: 40 }}
          icon={item.visit_id ? 'file-document-outline' : 'clipboard-play'}
          accessibilityLabel={getActionLabel(item)}
        >
          {getActionLabel(item)}
        </Button>
      </Surface>
    );
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <MaterialCommunityIcons name="file-document-outline" size={48} color={theme.colors.placeholder} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Нет заявок</Text>
      <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>
        Заявки появятся здесь после назначения
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Мои заявки</Text>
        <View style={styles.headerActions}>
          <NotificationBell />
          <SyncIndicator />
        </View>
      </View>

      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        buttons={[
          { value: 'all', label: `Все (${requests.length})` },
          { value: 'new', label: `Новые (${requests.filter(r => r.execution_status === 'new').length})` },
          { value: 'in_progress', label: `В работе (${requests.filter(r => r.execution_status === 'in_progress').length})` },
          { value: 'completed', label: `Завершённые (${requests.filter(r => r.execution_status === 'completed').length})` },
        ]}
        style={styles.tabs}
        theme={{ colors: { secondaryContainer: '#E0F2F1' } }}
      />

      {loading ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>Загрузка...</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: STATUS_BAR_HEIGHT + 16,
    paddingBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  tabs: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: BOTTOM_PADDING_TAB_SCREEN,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  requestNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7C3AED',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  address: {
    fontSize: 14,
    marginBottom: 4,
  },
  equipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  equipName: {
    fontSize: 12,
  },
  actionButton: {
    alignSelf: 'flex-start',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});
