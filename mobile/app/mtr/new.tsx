import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Text, Button, Searchbar, Surface } from 'react-native-paper';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/stores/authStore';
import api from '../../src/api/client';
import { STATUS_BAR_HEIGHT, BOTTOM_PADDING_NESTED_SCREEN } from '../../src/constants/layout';

function useCreateMtrVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const response = await api.post('/mtr/visits', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mtr-visits'] });
    },
  });
}

export default function NewMtrVisitScreen() {
  const router = useRouter();
  const createVisit = useCreateMtrVisit();
  const user = useAuthStore((state) => state.user);

  const [searchQuery, setSearchQuery] = useState('');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [date, setDate] = useState(new Date());
  const [timeStart, setTimeStart] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [error, setError] = useState('');
  const theme = useAppTheme();

  useEffect(() => {
    if (searchQuery.length < 2) {
      setAddresses([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/refs/addresses/search', {
          params: { q: searchQuery, limit: 10 },
        });
        setAddresses(response.data);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectAddress = (addr: any) => {
    setSelectedAddress({
      id: addr.id,
      full_address: addr.fullAddress || addr.full_address || '',
    });
    setSearchQuery(addr.fullAddress || addr.full_address || '');
    setAddresses([]);
  };

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const formatTime = (d: Date) => d.toTimeString().slice(0, 5);

  const handleCreate = async () => {
    if (!selectedAddress) {
      setError('Выберите адрес');
      return;
    }
    setError('');
    try {
      const visit = await createVisit.mutateAsync({
        address_id: selectedAddress.id,
        address: selectedAddress.full_address,
        date: formatDate(date),
        time_start: formatTime(timeStart),
        engineer_name: user?.fullName || 'Инженер',
      });
      router.replace(`/mtr/${visit.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания визита МТР');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Новый визит МТР</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Address */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            <MaterialCommunityIcons name="map-marker" size={14} color={theme.colors.primary} />{' '}
            Адрес объекта <Text style={styles.required}>*</Text>
          </Text>
          <Searchbar
            placeholder="Введите адрес для поиска..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[
              styles.search,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
            elevation={0}
            inputStyle={{ fontSize: 14 }}
          />
        </View>

        {addresses.length > 0 && (
          <Surface
            style={[
              styles.dropdown,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
            elevation={2}
          >
            {addresses.map((addr: any) => (
              <TouchableOpacity
                key={addr.id}
                onPress={() => handleSelectAddress(addr)}
                style={[
                  styles.dropdownItem,
                  { borderBottomColor: theme.colors.surfaceVariant },
                ]}
              >
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={16}
                  color={theme.colors.placeholder}
                />
                <Text style={[styles.dropdownText, { color: theme.colors.text }]}>
                  {addr.fullAddress || addr.full_address}
                </Text>
              </TouchableOpacity>
            ))}
          </Surface>
        )}

        {/* Date + Time */}
        <View style={styles.row}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              <MaterialCommunityIcons name="calendar" size={14} color={theme.colors.primary} />{' '}
              Дата <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.datePickerButton,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.datePickerText, { color: theme.colors.text }]}>
                {formatDate(date)}
              </Text>
              <MaterialCommunityIcons name="calendar" size={18} color={theme.colors.placeholder} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'android' ? 'default' : 'compact'}
                locale="ru-RU"
                onChange={(_event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.primary} />{' '}
              Время <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={[
                styles.datePickerButton,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.datePickerText, { color: theme.colors.text }]}>
                {formatTime(timeStart)}
              </Text>
              <MaterialCommunityIcons
                name="clock-outline"
                size={18}
                color={theme.colors.placeholder}
              />
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={timeStart}
                mode="time"
                display={Platform.OS === 'android' ? 'default' : 'compact'}
                locale="ru-RU"
                onChange={(_event, selectedTime) => {
                  setShowTimePicker(false);
                  if (selectedTime) setTimeStart(selectedTime);
                }}
              />
            )}
          </View>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} />
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          </View>
        ) : null}

        {/* Submit */}
        <Button
          mode="contained"
          onPress={handleCreate}
          loading={createVisit.isPending}
          disabled={!selectedAddress || createVisit.isPending}
          icon="plus"
          style={[styles.createBtn, { backgroundColor: theme.colors.primary }]}
          contentStyle={{ height: 48 }}
        >
          Создать визит МТР
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingTop: STATUS_BAR_HEIGHT + 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: BOTTOM_PADDING_NESTED_SCREEN },
  field: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  required: {},
  search: { borderWidth: 1, borderRadius: 12 },
  dropdown: { borderRadius: 12, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
  },
  dropdownText: { fontSize: 14, flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1, marginBottom: 16 },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  datePickerText: { fontSize: 14 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, fontWeight: '500', flex: 1 },
  createBtn: { borderRadius: 12 },
});
