import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useVisit } from '../../../src/api/queries';
import { useEquipmentRooms, useObjectEquipment, useCreateTask, useEquipmentTypes, useRoomTypes } from '../../../src/api/tasks';

type Step = 'room' | 'equipment';

export default function AddEquipmentScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const router = useRouter();
  const { data: visit } = useVisit(visitId);
  const addressId = visit?.address_id || '';

  const [step, setStep] = useState<Step>('room');
  const [selectedRoom, setSelectedRoom] = useState<{ id: string; name: string; code: string } | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());

  // Fallback: manual mode
  const [manualEqType, setManualEqType] = useState<string | null>(null);
  const [manualRoomType, setManualRoomType] = useState<string | null>(null);

  const { data: rooms, isLoading: loadingRooms } = useEquipmentRooms(addressId);
  const { data: equipment, isLoading: loadingEquipment } = useObjectEquipment(
    addressId,
    selectedRoom ? { binding_level: 'room', room_type_code: selectedRoom.code } : undefined
  );
  const { data: equipmentTypes } = useEquipmentTypes();
  const { data: roomTypes } = useRoomTypes();
  const createTask = useCreateTask();

  const hasRooms = rooms && rooms.length > 0;

  const handleRoomSelect = (room: { room_type_id: string; room_type_name: string; room_type_code: string }) => {
    setSelectedRoom({ id: room.room_type_id, name: room.room_type_name, code: room.room_type_code });
    setSelectedEquipment(new Set());
    setStep('equipment');
  };

  const toggleEquipment = (id: string) => {
    setSelectedEquipment(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!equipment) return;
    if (selectedEquipment.size === equipment.length) {
      setSelectedEquipment(new Set());
    } else {
      setSelectedEquipment(new Set(equipment.map(e => e.id)));
    }
  };

  const handleCreateBatch = async () => {
    if (!selectedRoom || selectedEquipment.size === 0) return;
    try {
      for (const eqId of selectedEquipment) {
        const eq = equipment?.find(e => e.id === eqId);
        if (!eq) continue;
        await createTask.mutateAsync({
          visitId,
          data: {
            equipmentTypeId: eq.equipment_type_id,
            roomTypeId: selectedRoom.id,
            roomTypeCode: selectedRoom.code,
          },
        });
      }
      router.back();
    } catch (error) {
      console.error('Error creating tasks:', error);
    }
  };

  const handleCreateManual = async () => {
    if (!manualEqType) return;
    const room = roomTypes?.find(r => r.id === manualRoomType);
    try {
      await createTask.mutateAsync({
        visitId,
        data: {
          equipmentTypeId: manualEqType,
          roomTypeId: manualRoomType || undefined,
          roomTypeCode: room?.code || undefined,
        },
      });
      router.back();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  if (loadingRooms) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  // Manual mode — no rooms from API
  if (!hasRooms) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#0F766E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Добавить оборудование</Text>
          <View style={styles.backBtn} />
        </View>
        <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.sectionTitle}>Тип оборудования *</Text>
          {equipmentTypes?.map((eq) => (
            <TouchableOpacity key={eq.id} onPress={() => setManualEqType(eq.id)} activeOpacity={0.7}>
              <View style={[styles.manualItem, manualEqType === eq.id && styles.manualItemSelected]}>
                <View style={[styles.checkbox, manualEqType === eq.id && styles.checkboxChecked]}>
                  {manualEqType === eq.id && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                </View>
                <Text style={styles.manualItemText}>{eq.name}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Помещение</Text>
          {roomTypes?.map((room) => (
            <TouchableOpacity key={room.id} onPress={() => setManualRoomType(manualRoomType === room.id ? null : room.id)} activeOpacity={0.7}>
              <View style={[styles.manualItem, manualRoomType === room.id && styles.manualItemSelected]}>
                <View style={[styles.checkbox, manualRoomType === room.id && styles.checkboxChecked]}>
                  {manualRoomType === room.id && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                </View>
                <Text style={styles.manualItemText}>{room.name}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <Button
            mode="contained"
            onPress={handleCreateManual}
            loading={createTask.isPending}
            disabled={!manualEqType || createTask.isPending}
            style={styles.addBtn}
            contentStyle={{ height: 48 }}
          >
            Добавить
          </Button>
        </ScrollView>
      </View>
    );
  }

  // Two-level mode: rooms → equipment
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {step === 'equipment' && (
          <TouchableOpacity onPress={() => setStep('room')} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#0F766E" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>
          {step === 'room' ? 'Добавить оборудование' : selectedRoom?.name || ''}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.steps}>
        <View style={styles.stepItem}>
          <View style={[styles.stepNum, step === 'room' ? styles.stepNumActive : styles.stepNumDone]}>
            <Text style={styles.stepNumText}>{step === 'equipment' ? '✓' : '1'}</Text>
          </View>
          <Text style={[styles.stepText, step === 'room' && styles.stepTextActive]}>Помещение</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={styles.stepItem}>
          <View style={[styles.stepNum, step === 'equipment' && styles.stepNumActive]}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <Text style={[styles.stepText, step === 'equipment' && styles.stepTextActive]}>Оборудование</Text>
        </View>
      </View>

      {step === 'room' ? (
        <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
          {rooms!.map((room) => (
            <TouchableOpacity key={room.room_type_id} onPress={() => handleRoomSelect(room)} activeOpacity={0.7}>
              <Surface style={styles.roomCard} elevation={0}>
                <View style={styles.roomIcon}>
                  <MaterialCommunityIcons name="home-group" size={22} color="#0F766E" />
                </View>
                <View style={styles.roomInfo}>
                  <Text style={styles.roomName}>{room.room_type_name}</Text>
                  <Text style={styles.roomCount}>{room.count} ед. оборудования</Text>
                </View>
                <View style={styles.roomBadge}>
                  <Text style={styles.roomBadgeText}>{room.count}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
              </Surface>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.content}>
          {equipment && equipment.length > 0 && (
            <View style={styles.toolbar}>
              <Text style={styles.counterText}>
                Выбрано: <Text style={styles.counterBold}>{selectedEquipment.size} из {equipment.length}</Text>
              </Text>
              <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn}>
                <View style={[styles.checkbox, selectedEquipment.size === equipment.length && styles.checkboxChecked]}>
                  {selectedEquipment.size === equipment.length && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                </View>
                <Text style={styles.selectAllText}>Все</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.equipList} contentContainerStyle={{ paddingBottom: 100 }}>
            {loadingEquipment ? (
              <ActivityIndicator size="large" color="#0F766E" style={{ marginTop: 40 }} />
            ) : equipment && equipment.length > 0 ? (
              equipment.map((eq) => {
                const isSelected = selectedEquipment.has(eq.id);
                return (
                  <TouchableOpacity key={eq.id} onPress={() => toggleEquipment(eq.id)} activeOpacity={0.7}>
                    <View style={[styles.eqItem, isSelected && styles.eqItemSelected]}>
                      <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                      </View>
                      <View style={styles.eqInfo}>
                        <Text style={styles.eqName}>{eq.equipment_type_name}</Text>
                        {(eq.brand || eq.model || eq.serial_number) && (
                          <Text style={styles.eqDetail}>
                            {[eq.brand, eq.model, eq.serial_number].filter(Boolean).join(' · ')}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>В этом помещении нет оборудования</Text>
              </View>
            )}
          </ScrollView>

          {selectedEquipment.size > 0 && (
            <View style={styles.bottomBar}>
              <Button
                mode="contained"
                onPress={handleCreateBatch}
                loading={createTask.isPending}
                disabled={createTask.isPending}
                style={styles.addBtn}
                contentStyle={{ height: 48 }}
              >
                Добавить ({selectedEquipment.size})
              </Button>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#0F172A' },
  steps: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', marginBottom: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  stepNumActive: { backgroundColor: '#0F766E' },
  stepNumDone: { backgroundColor: '#059669' },
  stepNumText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  stepText: { fontSize: 13, color: '#64748B' },
  stepTextActive: { color: '#0F172A', fontWeight: '600' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 12 },
  content: { flex: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  roomCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 8 },
  roomIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F0FDFA', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 14, fontWeight: '500', color: '#0F172A' },
  roomCount: { fontSize: 12, color: '#64748B', marginTop: 2 },
  roomBadge: { backgroundColor: 'rgba(15,118,110,0.1)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginRight: 8 },
  roomBadgeText: { fontSize: 12, fontWeight: '600', color: '#0F766E' },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginTop: 12 },
  emptyText: { fontSize: 13, color: '#64748B', marginTop: 4, textAlign: 'center' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  counterText: { fontSize: 12, color: '#64748B' },
  counterBold: { color: '#0F766E', fontWeight: '600' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectAllText: { fontSize: 13, color: '#0F766E', fontWeight: '600' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  equipList: { flex: 1, paddingHorizontal: 16 },
  eqItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 6, gap: 10 },
  eqItemSelected: { borderColor: '#0F766E', backgroundColor: '#F0FDFA' },
  eqInfo: { flex: 1 },
  eqName: { fontSize: 14, fontWeight: '500', color: '#0F172A' },
  eqDetail: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  addBtn: { backgroundColor: '#0F766E', borderRadius: 12, marginTop: 20 },
  manualItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 6, gap: 10 },
  manualItemSelected: { borderColor: '#0F766E', backgroundColor: '#F0FDFA' },
  manualItemText: { fontSize: 14, fontWeight: '500', color: '#0F172A' },
});
