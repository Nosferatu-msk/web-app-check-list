import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, SegmentedButtons } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { FormField, getFormFields, getDefaultValues } from '../constants/parameterForms';

interface ParameterFormProps {
  equipmentTypeCode?: string;
  parameters: Record<string, any>;
  onParameterChange: (key: string, value: any) => void;
}

// Допустимые диапазоны для числовых полей
const NUMBER_RANGES: Record<string, { min?: number; max?: number }> = {
  room_temp: { min: -40, max: 60 },
  temp_before: { min: -50, max: 100 },
  temp_after: { min: -50, max: 100 },
  outdoor_temperature: { min: -50, max: 60 },
  cooling_capacity: { min: 0, max: 100 },
  readings: { min: 0 },
  system_pressure: { min: 0, max: 20 },
  water_temperature: { min: 0, max: 150 },
  heating_temp: { min: 0, max: 150 },
  battery_capacity: { min: 0, max: 100 },
  runtime_hours: { min: 0 },
  hot_water_temp: { min: 0, max: 100 },
  cold_water_temp: { min: 0, max: 30 },
};

function validateNumber(key: string, value: string): string | null {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value.replace(',', '.'));
  if (isNaN(num)) return 'Введите число';
  const range = NUMBER_RANGES[key];
  if (range) {
    if (range.min !== undefined && num < range.min) return `Минимум: ${range.min}`;
    if (range.max !== undefined && num > range.max) return `Максимум: ${range.max}`;
  }
  return null;
}

export default function ParameterForm({ equipmentTypeCode, parameters, onParameterChange }: ParameterFormProps) {
  const theme = useAppTheme();
  const fields = getFormFields(equipmentTypeCode);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleBlur = useCallback((field: FormField, value: string) => {
    if (field.type === 'number') {
      const error = validateNumber(field.key, value);
      setErrors(prev => {
        const next = { ...prev };
        if (error) {
          next[field.key] = error;
        } else {
          delete next[field.key];
        }
        return next;
      });
    }
    if (field.type === 'text' && field.required && (!value || value.trim() === '')) {
      setErrors(prev => ({ ...prev, [field.key]: 'Обязательное поле' }));
    }
  }, []);

  const handleNumberChange = useCallback((field: FormField, text: string) => {
    const cleaned = text.replace(/[^0-9.,\-]/g, '');
    onParameterChange(field.key, cleaned);
    if (errors[field.key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field.key];
        return next;
      });
    }
  }, [onParameterChange, errors]);

  if (fields.length === 0) {
    return (
      <View style={styles.emptyForm}>
        <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>Форма параметров для данного типа оборудования не настроена</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {fields.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {field.label}
            {field.required && <Text style={[styles.required, { color: theme.colors.error }]}> *</Text>}
            {field.unit && <Text style={[styles.unit, { color: theme.colors.placeholder }]}> ({field.unit})</Text>}
          </Text>

          {field.type === 'select' && field.options ? (
            <SegmentedButtons
              value={parameters[field.key] || field.defaultValue || ''}
              onValueChange={(v) => onParameterChange(field.key, v)}
              buttons={field.options.map((opt) => ({ value: opt.value, label: opt.label }))}
              style={styles.segmented}
              theme={{ colors: { secondaryContainer: '#E0F2F1' } }}
            />
          ) : field.type === 'number' ? (
            <>
              <TextInput
                value={parameters[field.key]?.toString() || ''}
                onChangeText={(v) => handleNumberChange(field, v)}
                onBlur={() => handleBlur(field, parameters[field.key]?.toString() || '')}
                mode="outlined"
                keyboardType="numeric"
                style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: errors[field.key] ? theme.colors.error : theme.colors.border }]}
                contentStyle={{ fontSize: 14 }}
              />
              {errors[field.key] && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors[field.key]}</Text>
              )}
            </>
          ) : (
            <>
              <TextInput
                value={parameters[field.key] || ''}
                onChangeText={(v) => onParameterChange(field.key, v)}
                onBlur={() => handleBlur(field, parameters[field.key] || '')}
                mode="outlined"
                style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: errors[field.key] ? theme.colors.error : theme.colors.border }]}
                contentStyle={{ fontSize: 14 }}
              />
              {errors[field.key] && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors[field.key]}</Text>
              )}
            </>
          )}
        </View>
      ))}
    </View>
  );
}

export { getFormFields, getDefaultValues };

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 18,
  },
  required: {
  },
  unit: {
    fontWeight: '400',
  },
  segmented: {
    marginBottom: 0,
  },
  input: {
    borderRadius: 12,
  },
  emptyForm: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});
