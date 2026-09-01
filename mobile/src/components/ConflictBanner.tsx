import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getDatabase } from '../db';

interface ConflictBannerProps {
  onPress: () => void;
}

export default function ConflictBanner({ onPress }: ConflictBannerProps) {
  const [conflictCount, setConflictCount] = useState(0);

  const fetchConflictCount = useCallback(async () => {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM sync_queue WHERE error LIKE 'CONFLICT:%'`
      );
      setConflictCount(result?.count || 0);
    } catch {
      setConflictCount(0);
    }
  }, []);

  useEffect(() => {
    fetchConflictCount();
  }, [fetchConflictCount]);

  // Обновляем при фокусе экрана
  useEffect(() => {
    const interval = setInterval(fetchConflictCount, 5000);
    return () => clearInterval(interval);
  }, [fetchConflictCount]);

  if (conflictCount === 0) return null;

  const pluralLabel = conflictCount === 1 ? 'задача' : conflictCount < 5 ? 'задачи' : 'задач';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Конфликт синхронизации: ${conflictCount} ${pluralLabel}. Нажми для разрешения.`}
    >
      <View style={[styles.banner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
        <MaterialCommunityIcons name="alert" size={20} color="#D97706" />
        <Text style={[styles.text, { color: '#92400E' }]}>
          ⚠️ Конфликт синхронизации: {conflictCount} {pluralLabel}
        </Text>
        <View style={[styles.button, { backgroundColor: '#F59E0B' }]}>
          <Text style={styles.buttonText}>Разрешить</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
