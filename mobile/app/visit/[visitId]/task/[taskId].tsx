import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, SegmentedButtons } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTask, useUpdateTask } from '../../../../src/api/tasks';
import { Conclusion } from '../../../../src/types';

export default function TaskDetailScreen() {
  const { visitId, taskId } = useLocalSearchParams<{ visitId: string; taskId: string }>();
  const router = useRouter();
  const { data: task, isLoading } = useTask(visitId, taskId);
  const updateTask = useUpdateTask();

  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [conclusion, setConclusion] = useState<Conclusion | ''>('');
  const [recommendations, setRecommendations] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (task) {
      setParameters(task.parameters || {});
      setConclusion(task.conclusion || '');
      setRecommendations(task.additional_recommendations || '');
    }
  }, [task]);

  // Автосохранение каждые 30 секунд
  useEffect(() => {
    if (!isDirty) return;

    const timer = setInterval(() => {
      handleSave();
    }, 30000);

    return () => clearInterval(timer);
  }, [isDirty, parameters, conclusion, recommendations]);

  const handleSave = async () => {
    if (!visitId || !taskId) return;

    try {
      await updateTask.mutateAsync({
        visitId,
        taskId,
        data: {
          parameters,
          conclusion: conclusion || undefined,
          additional_recommendations: recommendations,
        },
      });
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const handleParameterChange = (key: string, value: any) => {
    setParameters((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  if (isLoading || !task) {
    return (
      <View style={styles.container}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          {task.equipment_type_name || 'Оборудование'}
        </Text>
        {task.room_type_name && (
          <Text variant="bodyMedium" style={styles.room}>
            {task.room_type_name}
          </Text>
        )}
      </View>

      {/* Индикатор сохранения */}
      <View style={styles.saveIndicator}>
        {isDirty ? (
          <Text variant="bodySmall" style={styles.unsaved}>
            ● Есть несохранённые изменения
          </Text>
        ) : lastSaved ? (
          <Text variant="bodySmall" style={styles.saved}>
            ✓ Сохранено {lastSaved.toLocaleTimeString('ru-RU')}
          </Text>
        ) : null}
      </View>

      {/* Параметры */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Параметры</Text>
        
        {/* Пример полей — в реальности зависит от типа оборудования */}
        <View style={styles.field}>
          <Text variant="bodyMedium" style={styles.label}>Температура (°C)</Text>
          <TextInput
            value={parameters.temperature?.toString() || ''}
            onChangeText={(v) => handleParameterChange('temperature', parseFloat(v) || 0)}
            mode="outlined"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.field}>
          <Text variant="bodyMedium" style={styles.label}>Давление (бар)</Text>
          <TextInput
            value={parameters.pressure?.toString() || ''}
            onChangeText={(v) => handleParameterChange('pressure', parseFloat(v) || 0)}
            mode="outlined"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.field}>
          <Text variant="bodyMedium" style={styles.label}>Примечание</Text>
          <TextInput
            value={parameters.note || ''}
            onChangeText={(v) => handleParameterChange('note', v)}
            mode="outlined"
            multiline
            numberOfLines={3}
          />
        </View>
      </View>

      {/* Заключение */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Заключение</Text>
        <SegmentedButtons
          value={conclusion}
          onValueChange={(v) => {
            setConclusion(v as Conclusion);
            setIsDirty(true);
          }}
          buttons={[
            { value: 'ok', label: 'Исправно' },
            { value: 'ok_with_notes', label: 'Замечания' },
            { value: 'faulty', label: 'Неисправно' },
          ]}
          style={styles.conclusionButtons}
        />
      </View>

      {/* Рекомендации */}
      {(conclusion === 'ok_with_notes' || conclusion === 'faulty') && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Дополнительные рекомендации *
          </Text>
          <TextInput
            value={recommendations}
            onChangeText={(v) => {
              setRecommendations(v);
              setIsDirty(true);
            }}
            mode="outlined"
            multiline
            numberOfLines={4}
            placeholder="Опишите замечания или неисправность..."
          />
        </View>
      )}

      {/* Кнопки */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => router.push(`/visit/${visitId}/task/${taskId}/photos`)}
          icon="camera"
          style={styles.photosButton}
        >
          Фото ДО/ПОСЛЕ
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={updateTask.isPending}
          disabled={!isDirty}
          style={styles.saveButton}
        >
          Сохранить
        </Button>
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
  header: {
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    color: '#0F172A',
  },
  room: {
    color: '#64748B',
    marginTop: 4,
  },
  saveIndicator: {
    marginBottom: 16,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  unsaved: {
    color: '#D97706',
  },
  saved: {
    color: '#059669',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    color: '#0F172A',
  },
  conclusionButtons: {
    marginBottom: 8,
  },
  actions: {
    marginTop: 16,
    gap: 12,
  },
  photosButton: {
    borderColor: '#0F766E',
  },
  saveButton: {
    backgroundColor: '#0F766E',
  },
});
