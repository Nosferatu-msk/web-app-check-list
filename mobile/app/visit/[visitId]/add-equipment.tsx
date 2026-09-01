import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Text, Button, Surface, ActivityIndicator, TextInput } from 'react-native-paper';
import { useAppTheme } from '../../../src/hooks/useAppTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useVisit } from '../../../src/api/queries';
import { useEquipmentRooms, useObjectEquipment, useCreateTask, useEquipmentTypes, useRoomTypes } from '../../../src/api/tasks';
import { getRoomIcon } from '../../../src/utils/roomIcons';
import { STATUS_BAR_HEIGHT, BOTTOM_PADDING_NESTED_SCREEN } from '../../../src/constants/layout';

type Step = 'room' | 'equipment';

export default function AddEquipmentScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const router = useRouter();
  const { data: visit } = useVisit(visitId);
  const addressId = visit?.address_id || '';
  const theme = useAppTheme();

  const [step, setStep] = useState<Step>('room');
  const [selectedRoom, setSelectedRoom] = useState<{ id: string; name: string; code: string } | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());

  // Fallback: manual mode
  const [manualEqType, setManualEqType] = useState<string | null>(null);
  const [manualRoomType, setManualRoomType] = useState<string | null>(null);
  const [manualBrand, setManualBrand] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [manualSerial, setManualSerial] = useState('');
  const [manualYear, setManualYear] = useState('');

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

  const INDOOR_CLIMATE_CODES = new Set(['splitvn', 'mssvn', 'vrv_vn']);

  const handleCreateBatch = async () => {
    if (!selectedRoom || selectedEquipment.size === 0) return;
    try {
      const climateItems: any[] = [];
      const regularItems: any[] = [];

      for (const eqId of selectedEquipment) {
        const eq = equipment?.find(e => e.id === eqId);
        if (!eq) continue;
        const eqType = equipmentTypes?.find(t => t.id === eq.equipment_type_id);
        if (eqType && INDOOR_CLIMATE_CODES.has(eqType.code)) {
          climateItems.push({ eq, eqType });
        } else {
          regularItems.push({ eq, eqType });
        }
      }

      // Внутренние блоки климата → одна групповая задача
      if (climateItems.length > 0) {
        await createTask.mutateAsync({
          visitId,
          data: {
            equipmentTypeId: climateItems[0].eq.equipment_type_id,
            roomTypeId: selectedRoom.id,
            roomTypeCode: selectedRoom.code,
            taskType: 'group_climate',
          },
        });
      }

      // Остальное оборудование → отдельные задачи
      for (const { eq } of regularItems) {
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
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>Загрузка...</Text>
      </View>
    );
  }

  // Manual mode — no rooms from API
  if (!hasRooms) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Добавить оборудование</Text>
          <View style={styles.backBtn} />
        </View>
        <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.warningBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#D97706" />
            <Text style={styles.warningText}>Оборудование не найдено в справочнике. Заполните данные вручную</Text>
          </View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Тип оборудования *</Text>
          {equipmentTypes?.map((eq) => (
            <TouchableOpacity key={eq.id} onPress={() => setManualEqType(eq.id)} activeOpacity={0.7}>
              <View style={[styles.manualItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, manualEqType === eq.id && [styles.manualItemSelected, { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}08` }]]}>
                <View style={[styles.checkbox, { borderColor: theme.colors.border }, manualEqType === eq.id && [styles.checkboxChecked, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]]}>
                  {manualEqType === eq.id && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                </View>
                <Text style={[styles.manualItemText, { color: theme.colors.text }]}>{eq.name}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 20 }]}>Помещение</Text>
          {roomTypes?.map((room) => (
            <TouchableOpacity key={room.id} onPress={() => setManualRoomType(manualRoomType === room.id ? null : room.id)} activeOpacity={0.7}>
              <View style={[styles.manualItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, manualRoomType === room.id && [styles.manualItemSelected, { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}08` }]]}>
                <View style={[styles.checkbox, { borderColor: theme.colors.border }, manualRoomType === room.id && [styles.checkboxChecked, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]]}>
                  {manualRoomType === room.id && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                </View>
                <Text style={[styles.manualItemText, { color: theme.colors.text }]}>{room.name}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 20 }]}>Дополнительно</Text>
          <TextInput
            label="Бренд"
            value={manualBrand}
            onChangeText={setManualBrand}
            mode="outlined"
            style={[styles.manualInput, { backgroundColor: theme.colors.surface }]}
          />
          <TextInput
            label="Модель"
            value={manualModel}
            onChangeText={setManualModel}
            mode="outlined"
            style={[styles.manualInput, { backgroundColor: theme.colors.surface }]}
          />
          <TextInput
            label="Серийный номер"
            value={manualSerial}
            onChangeText={setManualSerial}
            mode="outlined"
            style={[styles.manualInput, { backgroundColor: theme.colors.surface }]}
          />
          <TextInput
            label="Год установки"
            value={manualYear}
            onChangeText={setManualYear}
            mode="outlined"
            keyboardType="numeric"
            maxLength={4}
            style={[styles.manualInput, { backgroundColor: theme.colors.surface }]}
          />

          <Button
            mode="contained"
            onPress={handleCreateManual}
            loading={createTask.isPending}
            disabled={!manualEqType || createTask.isPending}
            style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        {step === 'equipment' && (
          <TouchableOpacity onPress={() => setStep('room')} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {step === 'room' ? 'Добавить оборудование' : selectedRoom?.name || ''}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.steps, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: theme.colors.border }, step === 'room' ? [styles.stepNumActive, { backgroundColor: theme.colors.primary }] : [styles.stepNumDone, { backgroundColor: theme.colors.success }]]}>
            <Text style={styles.stepNumText}>{step === 'equipment' ? '✓' : '1'}</Text>
          </View>
          <Text style={[styles.stepText, { color: theme.colors.placeholder }, step === 'room' && [styles.stepTextActive, { color: theme.colors.text }]]}>Помещение</Text>
        </View>
        <View style={[styles.stepLine, { backgroundColor: theme.colors.border }]} />
        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: theme.colors.border }, step === 'equipment' && [styles.stepNumActive, { backgroundColor: theme.colors.primary }]]}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <Text style={[styles.stepText, { color: theme.colors.placeholder }, step === 'equipment' && [styles.stepTextActive, { color: theme.colors.text }]]}>Оборудование</Text>
        </View>
      </View>

      {step === 'room' ? (
        <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
          {rooms!.map((room) => (
            <TouchableOpacity key={room.room_type_id} onPress={() => handleRoomSelect(room)} activeOpacity={0.7}>
              <Surface style={[styles.roomCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} elevation={0}>
                <View style={[styles.roomIcon, { backgroundColor: `${theme.colors.primary}08` }]}>
                  <MaterialCommunityIcons name={getRoomIcon(room.room_type_code) as any} size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.roomInfo}>
                  <Text style={[styles.roomName, { color: theme.colors.text }]}>{room.room_type_name}</Text>
                  <Text style={[styles.roomCount, { color: theme.colors.placeholder }]}>{room.count} ед. оборудования</Text>
                </View>
                <View style={styles.roomBadge}>
                  <Text style={[styles.roomBadgeText, { color: theme.colors.primary }]}>{room.count}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.placeholder} />
              </Surface>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.content}>
          {equipment && equipment.length > 0 && (
            <View style={styles.toolbar}>
              <Text style={[styles.counterText, { color: theme.colors.placeholder }]}>
                Выбрано: <Text style={[styles.counterBold, { color: theme.colors.primary }]}>{selectedEquipment.size} из {equipment.length}</Text>
              </Text>
              <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn}>
                <View style={[styles.checkbox, { borderColor: theme.colors.border }, selectedEquipment.size === equipment.length && [styles.checkboxChecked, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]]}>
                  {selectedEquipment.size === equipment.length && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                </View>
                <Text style={[styles.selectAllText, { color: theme.colors.primary }]}>Все</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.equipList} contentContainerStyle={{ paddingBottom: 100 }}>
            {loadingEquipment ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
            ) : equipment && equipment.length > 0 ? (
              equipment.map((eq) => {
                const isSelected = selectedEquipment.has(eq.id);
                return (
                  <TouchableOpacity key={eq.id} onPress={() => toggleEquipment(eq.id)} activeOpacity={0.7}>
                    <View style={[styles.eqItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, isSelected && [styles.eqItemSelected, { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}08` }]]}>
                      <View style={[styles.checkbox, { borderColor: theme.colors.border }, isSelected && [styles.checkboxChecked, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]]}>
                        {isSelected && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                      </View>
                      <View style={styles.eqInfo}>
                        <Text style={[styles.eqName, { color: theme.colors.text }]}>{eq.equipment_type_name}</Text>
                        {(eq.brand || eq.model || eq.serial_number) && (
                          <Text style={[styles.eqDetail, { color: theme.colors.placeholder }]}>
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
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>В этом помещении нет оборудования</Text>
              </View>
            )}
          </ScrollView>

          {selectedEquipment.size > 0 && (
            <View style={[styles.bottomBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
              <Button
                mode="contained"
                onPress={handleCreateBatch}
                loading={createTask.isPending}
                disabled={createTask.isPending}
                style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
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
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: STATUS_BAR_HEIGHT + 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  steps: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepNum: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  stepNumActive: {},
  stepNumDone: {},
  stepNumText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  stepText: { fontSize: 13 },
  stepTextActive: { fontWeight: '600' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 12 },
  content: { flex: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  roomCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 8 },
  roomIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 14, fontWeight: '500' },
  roomCount: { fontSize: 12, marginTop: 2 },
  roomBadge: { backgroundColor: 'rgba(15,118,110,0.1)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginRight: 8 },
  roomBadgeText: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyText: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  counterText: { fontSize: 12 },
  counterBold: { fontWeight: '600' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectAllText: { fontSize: 13, fontWeight: '600' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: {},
  equipList: { flex: 1, paddingHorizontal: 16 },
  eqItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 6, gap: 10 },
  eqItemSelected: {},
  eqInfo: { flex: 1 },
  eqName: { fontSize: 14, fontWeight: '500' },
  eqDetail: { fontSize: 11, marginTop: 2 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: BOTTOM_PADDING_NESTED_SCREEN, borderTopWidth: 1 },
  addBtn: { borderRadius: 12, marginTop: 20 },
  warningBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: 'rgba(217,119,6,0.08)', borderRadius: 10, marginBottom: 16 },
  warningText: { flex: 1, fontSize: 13, color: '#D97706', lineHeight: 18 },
  manualInput: { marginBottom: 12, borderRadius: 12 },
  manualItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 6, gap: 10 },
  manualItemSelected: {},
  manualItemText: { fontSize: 14, fontWeight: '500' },
});
