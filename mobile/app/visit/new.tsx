import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, Searchbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCreateVisit } from '../../src/api/queries';
import { Address } from '../../src/types';
import api from '../../src/api/client';

export default function NewVisitScreen() {
  const router = useRouter();
  const createVisit = useCreateVisit();

  const [searchQuery, setSearchQuery] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeStart, setTimeStart] = useState(
    new Date().toTimeString().slice(0, 5)
  );
  const [season, setSeason] = useState<'summer' | 'winter'>(() => {
    const month = new Date().getMonth() + 1;
    return month >= 4 && month <= 10 ? 'summer' : 'winter';
  });
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Поиск адресов
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
      } catch (error) {
        console.error('Error searching addresses:', error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Запрос GPS
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLatitude(location.coords.latitude);
        setLongitude(location.coords.longitude);
        setGpsAccuracy(location.coords.accuracy);
      } catch (error) {
        console.error('Error getting location:', error);
      }
    })();
  }, []);

  const handleSelectAddress = (address: any) => {
    setSelectedAddress({
      id: address.id,
      full_address: address.fullAddress || address.full_address || '',
      city: address.city || '',
      street: address.street || '',
      house: address.house || '',
      building: address.building || '',
    });
    setSearchQuery(address.fullAddress || address.full_address || '');
    setAddresses([]);
  };

  const handleCreate = async () => {
    if (!selectedAddress) return;

    setLoading(true);
    try {
      const visit = await createVisit.mutateAsync({
        address_id: selectedAddress.id,
        address: selectedAddress.full_address,
        date,
        time_start: timeStart,
        season,
      });
      router.replace(`/visit/${visit.id}`);
    } catch (error) {
      console.error('Error creating visit:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGpsColor = () => {
    if (!gpsAccuracy) return '#64748B';
    if (gpsAccuracy < 50) return '#059669';
    if (gpsAccuracy < 200) return '#D97706';
    return '#DC2626';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>Новый визит</Text>

      <Text variant="titleMedium" style={styles.label}>Адрес объекта</Text>
      <Searchbar
        placeholder="Поиск адреса..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.search}
      />
      
      {addresses.length > 0 && (
        <View style={styles.addressList}>
          {addresses.map((addr: any) => (
            <Button
              key={addr.id}
              mode="text"
              onPress={() => handleSelectAddress(addr)}
              style={styles.addressItem}
              contentStyle={styles.addressItemContent}
            >
              {addr.fullAddress || addr.full_address || ''}
            </Button>
          ))}
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.field}>
          <Text variant="titleMedium" style={styles.label}>Дата</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            mode="outlined"
            placeholder="ГГГГ-ММ-ДД"
          />
        </View>
        <View style={styles.field}>
          <Text variant="titleMedium" style={styles.label}>Время</Text>
          <TextInput
            value={timeStart}
            onChangeText={setTimeStart}
            mode="outlined"
            placeholder="ЧЧ:ММ"
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text variant="titleMedium" style={styles.label}>Сезон</Text>
        <Button
          mode={season === 'summer' ? 'contained' : 'outlined'}
          onPress={() => setSeason(season === 'summer' ? 'winter' : 'summer')}
          style={styles.seasonButton}
        >
          {season === 'summer' ? '☀️ Лето' : '❄️ Зима'}
        </Button>
      </View>

      {latitude && longitude && (
        <View style={styles.gps}>
          <Text variant="titleMedium" style={styles.label}>GPS-координаты</Text>
          <View style={styles.gpsInfo}>
            <Text variant="bodyMedium">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </Text>
            {gpsAccuracy && (
              <Text variant="bodySmall" style={{ color: getGpsColor() }}>
                Точность: ±{Math.round(gpsAccuracy)} м
              </Text>
            )}
          </View>
        </View>
      )}

      <Button
        mode="contained"
        onPress={handleCreate}
        loading={loading}
        disabled={!selectedAddress || loading}
        style={styles.createButton}
        contentStyle={styles.createButtonContent}
      >
        Создать визит
      </Button>
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
  title: {
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 24,
  },
  label: {
    marginBottom: 8,
    color: '#0F172A',
  },
  search: {
    marginBottom: 8,
    elevation: 0,
    backgroundColor: '#FFFFFF',
  },
  addressList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addressItem: {
    justifyContent: 'flex-start',
  },
  addressItemContent: {
    justifyContent: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    flex: 1,
    marginBottom: 16,
  },
  seasonButton: {
    backgroundColor: '#0F766E',
  },
  gps: {
    marginBottom: 16,
  },
  gpsInfo: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  createButton: {
    marginTop: 16,
    backgroundColor: '#0F766E',
  },
  createButtonContent: {
    height: 48,
  },
});
