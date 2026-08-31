import { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Button, SegmentedButtons, FAB, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useVisits } from '../../src/api/queries';
import VisitCard from '../../src/components/VisitCard';
import VisitCardSkeleton from '../../src/components/VisitCardSkeleton';
import SyncIndicator from '../../src/components/SyncIndicator';
import { Visit } from '../../src/types';

export default function VisitsScreen() {
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const router = useRouter();
  const theme = useTheme();

  const { data: visits, isLoading, error, refetch, isRefetching } = useVisits(tab);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const renderVisit = ({ item }: { item: Visit }) => <VisitCard visit={item} />;

  const renderSkeleton = () => <VisitCardSkeleton />;

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text variant="titleLarge" style={styles.emptyTitle}>
        Нет визитов
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {tab === 'active'
          ? 'Создайте первый визит для начала работы'
          : 'Завершённые визиты появятся здесь'}
      </Text>
      {tab === 'active' && (
        <Button
          mode="contained"
          onPress={() => router.push('/visit/new')}
          style={styles.emptyButton}
          icon="plus"
        >
          Создать визит
        </Button>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Мои визиты</Text>
        <SyncIndicator />
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
          <Text variant="titleLarge" style={styles.emptyTitle}>
            Ошибка загрузки
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Не удалось загрузить визиты. Проверьте подключение к сети.
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
              tintColor="#0F766E"
            />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB для создания визита */}
      <FAB
        icon="plus"
        onPress={() => router.push('/visit/new')}
        style={styles.fab}
        color="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontWeight: '700',
    color: '#0F172A',
  },
  tabs: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  list: {
    paddingBottom: 80, // Место для FAB
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
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#0F766E',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#0F766E',
  },
});
