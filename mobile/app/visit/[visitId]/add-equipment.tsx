import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Text, Button, Surface, Searchbar, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEquipmentTypes, useRoomTypes, useCreateTask } from '../../../src/api/tasks';

export default function AddEquipmentScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const router = useRouter();

  const { data: equipmentTypes, isLoading: loadingEquipment } = useEquipmentTypes();
  const { data: roomTypes, isLoading: loadingRooms } = useRoomTypes();
  const createTask = useCreateTask();

  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');

  const filteredEquipment = equipmentTypes?.filter((e) =>
    e.name.toLowerCase().includes(equipmentSearch.toLowerCase())
  ) || [];

  const filteredRooms = roomTypes?.filter((r) =>
    r.name.toLowerCase().includes(roomSearch.toLowerCase())
  ) || [];

  const handleCreate = async () => {
    if (!selectedEquipment) return;

    const room = roomTypes?.find((r) => r.id === selectedRoom);

    try {
      await createTask.mutateAsync({
        visitId,
        data: {
          equipmentTypeId: selectedEquipment,
          roomTypeId: selectedRoom || undefined,
          roomTypeCode: room?.code || undefined,
        },
      });
      router.back();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  if (loadingEquipment || loadingRooms) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Загрузка справочников...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>
        Добавить оборудование
      </Text>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Тип оборудования *
      </Text>
      <Searchbar
        placeholder="Поиск оборудования..."
        value={equipmentSearch}
        onChangeText={setEquipmentSearch}
        style={styles.search}
        elevation={0}
      />
      <View style={styles.chipList}>
        {filteredEquipment.map((eq) => (
          <TouchableOpacity
            key={eq.id}
            onPress={() => setSelectedEquipment(eq.id)}
            activeOpacity={0.7}
          >
            <Surface
              style={[
                styles.chip,
                selectedEquipment === eq.id && styles.chipSelected,
              ]}
              elevation={0}
            >
              <MaterialCommunityIcons
                name="cog"
                size={18}
                color={selectedEquipment === eq.id ? '#FFFFFF' : '#0F766E'}
              />
              <Text
                style={[
                  styles.chipText,
                  selectedEquipment === eq.id && styles.chipTextSelected,
                ]}
              >
                {eq.name}
              </Text>
              {selectedEquipment === eq.id && (
                <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
              )}
            </Surface>
          </TouchableOpacity>
        ))}
      </View>

      <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: 24 }]}>
        Помещение
      </Text>
      <Searchbar
        placeholder="Поиск помещения..."
        value={roomSearch}
        onChangeText={setRoomSearch}
        style={styles.search}
        elevation={0}
      />
      <View style={styles.chipList}>
        {filteredRooms.map((room) => (
          <TouchableOpacity
            key={room.id}
            onPress={() => setSelectedRoom(selectedRoom === room.id ? null : room.id)}
            activeOpacity={0.7}
          >
            <Surface
              style={[
                styles.chip,
                selectedRoom === room.id && styles.chipSelected,
              ]}
              elevation={0}
            >
              <MaterialCommunityIcons
                name="door"
                size={18}
                color={selectedRoom === room.id ? '#FFFFFF' : '#64748B'}
              />
              <Text
                style={[
                  styles.chipText,
                  selectedRoom === room.id && styles.chipTextSelected,
                ]}
              >
                {room.name}
              </Text>
              {selectedRoom === room.id && (
                <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
              )}
            </Surface>
          </TouchableOpacity>
        ))}
      </View>

      <Button
        mode="contained"
        onPress={handleCreate}
        loading={createTask.isPending}
        disabled={!selectedEquipment || createTask.isPending}
        icon="plus"
        style={styles.createButton}
        contentStyle={{ height: 48 }}
      >
        Добавить
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', marginTop: 12 },
  title: { fontWeight: '700', color: '#0F172A', marginBottom: 24 },
  sectionTitle: { fontWeight: '600', color: '#0F172A', marginBottom: 8 },
  search: { marginBottom: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  chipSelected: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  chipText: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
  chipTextSelected: { color: '#FFFFFF' },
  createButton: { marginTop: 24, backgroundColor: '#0F766E', borderRadius: 12 },
});
