import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Searchbar, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCreateVisit } from '../../src/api/queries';
import { Address } from '../../src/types';
import api from '../../src/api/client';

export default function NewVisitScreen() {
  const router = useRouter();
  const createVisit = useCreateVisit();

  const [searchQuery, setSearchQuery] = useState('');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeStart, setTimeStart] = useState(new Date().toTimeString().slice(0, 5));
  const [season, setSeason] = useState<'summer' | 'winter'>(() => {
    const month = new Date().getMonth() + 1;
    return month >= 4 && month <= 10 ? 'summer' : 'winter';
  });
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchQuery.length < 2) { setAddresses([]); return; }
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/refs/addresses/search', { params: { q: searchQuery, limit: 10 } });
        setAddresses(response.data);
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLatitude(loc.coords.latitude);
        setLongitude(loc.coords.longitude);
        setGpsAccuracy(loc.coords.accuracy);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const handleSelectAddress = (addr: any) => {
    setSelectedAddress({
      id: addr.id,
      full_address: addr.fullAddress || addr.full_address || '',
    });
    setSearchQuery(addr.fullAddress || addr.full_address || '');
    setAddresses([]);
  };

  const handleCreate = async () => {
    if (!selectedAddress) { setError('Выберите адрес'); return; }
    setError('');
    try {
      const visit = await createVisit.mutateAsync({
        address_id: selectedAddress.id,
        address: selectedAddress.full_address,
        date,
        time_start: timeStart,
        season,
        engineer_name: '',
      });
      router.replace(`/visit/${visit.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания визита');
    }
  };

  const gpsColor = !gpsAccuracy ? '#64748B' : gpsAccuracy < 50 ? '#059669' : gpsAccuracy < 200 ? '#D97706' : '#DC2626';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0F766E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Новый визит</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Address */}
        <View style={styles.field}>
          <Text style={styles.label}>
            <MaterialCommunityIcons name="map-marker" size={14} color="#0F766E" /> Адрес объекта <Text style={styles.required}>*</Text>
          </Text>
          <Searchbar
            placeholder="Введите адрес для поиска..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.search}
            elevation={0}
            inputStyle={{ fontSize: 14 }}
          />
        </View>

        {addresses.length > 0 && (
          <Surface style={styles.dropdown} elevation={2}>
            {addresses.map((addr: any, i: number) => (
              <TouchableOpacity key={addr.id} onPress={() => handleSelectAddress(addr)} style={styles.dropdownItem}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color="#94A3B8" />
                <Text style={styles.dropdownText}>{addr.fullAddress || addr.full_address}</Text>
              </TouchableOpacity>
            ))}
          </Surface>
        )}

        {/* Date + Time */}
        <View style={styles.row}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>
              <MaterialCommunityIcons name="calendar" size={14} color="#0F766E" /> Дата <Text style={styles.required}>*</Text>
            </Text>
            <TextInput value={date} onChangeText={setDate} mode="outlined" style={styles.input} contentStyle={{ fontSize: 14 }} placeholder="ГГГГ-ММ-ДД" />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>
              <MaterialCommunityIcons name="clock-outline" size={14} color="#0F766E" /> Время <Text style={styles.required}>*</Text>
            </Text>
            <TextInput value={timeStart} onChangeText={setTimeStart} mode="outlined" style={styles.input} contentStyle={{ fontSize: 14 }} placeholder="ЧЧ:ММ" />
          </View>
        </View>

        {/* Season */}
        <View style={styles.field}>
          <Text style={styles.label}>Сезон</Text>
          <View style={styles.seasonRow}>
            <TouchableOpacity onPress={() => setSeason('summer')} style={[styles.seasonBtn, season === 'summer' && styles.seasonBtnActive]}>
              <MaterialCommunityIcons name="weather-sunny" size={18} color={season === 'summer' ? '#FFF' : '#D97706'} />
              <Text style={[styles.seasonBtnText, season === 'summer' && styles.seasonBtnTextActive]}>Лето</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSeason('winter')} style={[styles.seasonBtn, season === 'winter' && styles.seasonBtnActive]}>
              <MaterialCommunityIcons name="weather-snowy" size={18} color={season === 'winter' ? '#FFF' : '#0369A1'} />
              <Text style={[styles.seasonBtnText, season === 'winter' && styles.seasonBtnTextActive]}>Зима</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* GPS */}
        {latitude !== null && longitude !== null && (
          <View style={styles.gpsCard}>
            <View style={styles.gpsHeader}>
              <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#0F766E" />
              <Text style={styles.gpsTitle}>GPS-координаты</Text>
            </View>
            <Text style={styles.gpsCoords}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>
            {gpsAccuracy && (
              <Text style={[styles.gpsAccuracy, { color: gpsColor }]}>
                Точность: ±{Math.round(gpsAccuracy)} м
              </Text>
            )}
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Submit */}
        <Button
          mode="contained"
          onPress={handleCreate}
          loading={createVisit.isPending}
          disabled={!selectedAddress || createVisit.isPending}
          icon="plus"
          style={styles.createBtn}
          contentStyle={{ height: 48 }}
        >
          Создать визит
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#0F172A' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 6, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 },
  required: { color: '#DC2626' },
  search: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12 },
  dropdown: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownText: { fontSize: 14, color: '#0F172A', flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1, marginBottom: 16 },
  input: { backgroundColor: '#FFF', borderRadius: 12 },
  seasonRow: { flexDirection: 'row', gap: 10 },
  seasonBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: 'transparent' },
  seasonBtnActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  seasonBtnText: { fontSize: 14, fontWeight: '500', color: '#64748B' },
  seasonBtnTextActive: { color: '#FFF', fontWeight: '600' },
  gpsCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  gpsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  gpsTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  gpsCoords: { fontSize: 14, color: '#0F172A', fontFamily: 'monospace' },
  gpsAccuracy: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, backgroundColor: 'rgba(220,38,38,0.08)', borderRadius: 10, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#DC2626', fontWeight: '500', flex: 1 },
  createBtn: { backgroundColor: '#0F766E', borderRadius: 12 },
});
