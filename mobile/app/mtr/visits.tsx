import { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Button, SegmentedButtons, FAB } from 'react-native-paper';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import VisitCard from '../../src/components/VisitCard';
import VisitCardSkeleton from '../../src/components/VisitCardSkeleton';
import SyncIndicator from '../../src/components/SyncIndicator';
import NotificationBell from '../../src/components/NotificationBell';
import { Visit } from '../../src/types';
import { STATUS_BAR_HEIGHT, BOTTOM_PADDING_TAB_SCREEN } from '../../src/constants/layout';
import api from '../../src/api/client';

function useMtrVisits(tab: 'active' | 'completed') {
  return useQuery({
    queryKey: ['mtr-visits', tab],
    queryFn: async () => {
      const response = await api.get('/mtr/visits', { params: { status: tab } });
      return response.data as Visit[];
    },
  });
}

export default function MtrVisitsScreen() {
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const router = useRouter();
  const theme = useAppTheme();

  const { data: visits, isLoading, error, refetch, isRefetching } = useMtrVisits(tab);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const renderVisit = ({ item }: { item: Visit }) => <VisitCard visit={item} />;

  const renderSkeleton = () => <VisitCardSkeleton />;

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text variant="titleLarge" style={[styles.emptyTitle, { color: theme.colors.text }]}>
        Нет визитов МТР
      </Text>
      <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.placeholder }]}>
        {tab === 'active'
          ? 'Создайте первый визит МТР для начала работы'
          : 'Завершённые визиты МТР появятся здесь'}
      </Text>
      {tab === 'active' && (
        <Button
          mode="contained"
          onPress={() => router.push('/mtr/new')}
          style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
          icon="plus"
        >
          Создать визит МТР
        </Button>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Визиты МТР</Text>
        <View style={styles.headerActions}>
          <NotificationBell />
          <SyncIndicator />
        </View>
      </View>

      <SegmentedButtons
        value={tab}
        onValueChange={(value) => setTab(value as 'active' | 'completed')}
        buttons={[
          { value: 'active', label: 'Активные', icon: 'clipboard-clock-outline' },
          { value: 'completed', label: 'Завершённые', icon: 'clipboard-check-outline' },
        ]}
        style={styles.tabs}
        theme={{ colors: { secondaryContainer: '#E0F2F1' } }}
      />

      {isLoading ? (
        <FlatList
          data={[1, 2, 3]}
          renderItem={renderSkeleton}
          keyExtractor={(item) => item.toString()}
          showsVerticalScrollIndicator={false}
        />
      ) : error ? (
        <View style={styles.empty}>
          <Text variant="titleLarge" style={[styles.emptyTitle, { color: theme.colors.text }]}>
            Ошибка загрузки
          </Text>
          <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.placeholder }]}>
            Не удалось загрузить визиты МТР. Проверьте подключение к сети.
          </Text>
          <Button
            mode="contained"
            onPress={() => refetch()}
            style={styles.emptyButton}
            icon="refresh"
          >
            Повторить
          </Button>
        </View>
      ) : (
        <FlatList
          data={visits || []}
          renderItem={renderVisit}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FAB
        icon="plus"
        onPress={() => router.push('/mtr/new')}
        style={styles.fab}
        color={theme.colors.surface}
      />
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
    paddingBottom: BOTTOM_PADDING_TAB_SCREEN,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {},
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 100,
  },
});
