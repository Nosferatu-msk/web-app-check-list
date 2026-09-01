import { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, SegmentedButtons } from 'react-native-paper';
import { useAppTheme } from '../../../../src/hooks/useAppTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTask, useUpdateTask } from '../../../../src/api/tasks';
import { Conclusion } from '../../../../src/types';
import CustomHeader from '../../../../src/components/CustomHeader';
import ParameterForm, { getDefaultValues, getFormFields } from '../../../../src/components/ParameterForm';
import RecommendationsList from '../../../../src/components/RecommendationsList';
import VoiceInputButton from '../../../../src/components/VoiceInputButton';
import { BOTTOM_PADDING_NESTED_SCREEN } from '../../../../src/constants/layout';

export default function TaskDetailScreen() {
  const { visitId, taskId } = useLocalSearchParams<{ visitId: string; taskId: string }>();
  const router = useRouter();
  const { data: task, isLoading } = useTask(visitId, taskId);
  const updateTask = useUpdateTask();
  const theme = useAppTheme();

  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [conclusion, setConclusion] = useState<Conclusion | ''>('');
  const [recommendations, setRecommendations] = useState('');
  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Ref для актуальных значений (избегаем stale closure в setInterval)
  const saveDataRef = useRef({ parameters, conclusion, recommendations, selectedRecIds, isDirty });
  useEffect(() => {
    saveDataRef.current = { parameters, conclusion, recommendations, selectedRecIds, isDirty };
  }, [parameters, conclusion, recommendations, selectedRecIds, isDirty]);

  useEffect(() => {
    if (task) {
      const defaults = getDefaultValues(getFormFields(task.equipment_type_code));
      setParameters({ ...defaults, ...(task.parameters || {}) });
      setConclusion(task.conclusion || '');
      setRecommendations(task.additional_recommendations || '');
      setSelectedRecIds(task.selected_recommendation_ids || []);
    }
  }, [task]);

  const handleSave = useCallback(async () => {
    if (!visitId || !taskId) return;
    const { parameters: p, conclusion: c, recommendations: r, selectedRecIds: s } = saveDataRef.current;

    try {
      await updateTask.mutateAsync({
        visitId,
        taskId,
        data: {
          parameters: p,
          conclusion: c || undefined,
          additional_recommendations: r,
          selected_recommendation_ids: s,
        },
      });
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving task:', error);
    }
  }, [visitId, taskId, updateTask]);

  // Автосохранение каждые 30 секунд
  useEffect(() => {
    if (!isDirty) return;

    const timer = setInterval(() => {
      if (saveDataRef.current.isDirty) {
        handleSave();
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [isDirty, handleSave]);

  const handleParameterChange = (key: string, value: any) => {
    setParameters((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  if (isLoading || !task) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Задача" />
        <View style={styles.loadingBox}>
          <Text>Загрузка...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <CustomHeader title="Задача" />
      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={[styles.title, { color: theme.colors.text }]}>
          {task.equipment_type_name || 'Оборудование'}
        </Text>
        {task.room_type_name && (
          <Text variant="bodyMedium" style={[styles.room, { color: theme.colors.placeholder }]}>
            {task.room_type_name}
          </Text>
        )}
      </View>

      {/* Индикатор сохранения */}
      <View style={[styles.saveIndicator, { backgroundColor: theme.colors.surface }]}>
        {isDirty ? (
          <Text variant="bodySmall" style={[styles.unsaved, { color: theme.colors.warning }]}>
            ● Есть несохранённые изменения
          </Text>
        ) : lastSaved ? (
          <Text variant="bodySmall" style={[styles.saved, { color: theme.colors.success }]}>
            ✓ Сохранено {lastSaved.toLocaleTimeString('ru-RU')}
          </Text>
        ) : null}
      </View>

      {/* Параметры — специализированная форма по типу оборудования */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.text }]}>Параметры</Text>
        <ParameterForm
          equipmentTypeCode={task.equipment_type_code}
          parameters={parameters}
          onParameterChange={handleParameterChange}
        />
      </View>

      {/* Примечание */}
      <View style={styles.section}>
        <View style={styles.noteHeader}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.text }]}>Примечание</Text>
          <VoiceInputButton
            onTranscript={(text) => {
              const current = parameters.note || '';
              handleParameterChange('note', current ? `${current}. ${text}` : text);
            }}
          />
        </View>
        <TextInput
          value={parameters.note || ''}
          onChangeText={(v) => handleParameterChange('note', v)}
          mode="outlined"
          multiline
          numberOfLines={3}
          placeholder="Дополнительные заметки..."
        />
      </View>

      {/* Заключение */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.text }]}>Заключение</Text>
        <SegmentedButtons
          value={conclusion}
          onValueChange={(v) => {
            setConclusion(v as Conclusion);
            setIsDirty(true);
          }}
          buttons={[
            { value: 'Исправно, замечаний нет', label: 'Исправно' },
            { value: 'Исправно, есть замечания', label: 'Замечания' },
            { value: 'Неисправно', label: 'Неисправно' },
          ]}
          style={styles.conclusionButtons}
        />
      </View>

      {/* Типовые рекомендации — чекбоксы из справочника */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Типовые рекомендации
        </Text>
        <RecommendationsList
          equipmentTypeCode={task.equipment_type_code}
          selectedIds={selectedRecIds}
          onSelectionChange={(ids) => {
            setSelectedRecIds(ids);
            setIsDirty(true);
          }}
        />
      </View>

      {/* Дополнительные рекомендации — обязательны при замечаниях/неисправности */}
      {(conclusion === 'Исправно, есть замечания' || conclusion === 'Неисправно') && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Дополнительные рекомендации <Text style={[styles.required, { color: theme.colors.error }]}>*</Text>
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
          style={[styles.photosButton, { borderColor: theme.colors.primary }]}
          accessibilityLabel="Фото ДО/ПОСЛЕ"
        >
          Фото ДО/ПОСЛЕ
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={updateTask.isPending}
          disabled={!isDirty}
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          accessibilityLabel="Сохранить"
        >
          Сохранить
        </Button>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: BOTTOM_PADDING_NESTED_SCREEN,
  },
  loadingBox: {
    padding: 32,
    alignItems: 'center',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
  },
  room: {
    marginTop: 4,
  },
  saveIndicator: {
    marginBottom: 16,
    padding: 8,
    borderRadius: 8,
  },
  unsaved: {},
  saved: {},
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  required: {},
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
  conclusionButtons: {
    marginBottom: 8,
  },
  actions: {
    marginTop: 16,
    gap: 12,
  },
  photosButton: {},
  saveButton: {},
});
