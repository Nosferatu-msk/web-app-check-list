import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Select, Button, Table, Modal, Tag, Space, App, Popconfirm, DatePicker, TimePicker, Spin, Checkbox, Tabs, List, Empty, AutoComplete, Dropdown } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, CheckOutlined, SaveOutlined, EllipsisOutlined, CheckCircleOutlined, SyncOutlined, ClockCircleOutlined, CameraOutlined, EditOutlined, PictureOutlined } from '@ant-design/icons';
import { api, isOffline } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useAutoSave } from '../hooks/useAutoSave';
import { useIsMobile } from '../hooks/useIsMobile';
import TorchButton from '../components/TorchButton';
import NotificationBell from '../components/NotificationBell';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  not_started: { color: 'default', label: 'Не начато' },
  in_progress: { color: 'processing', label: 'В работе' },
  completed: { color: 'success', label: 'Выполнено' },
};

function determineSeason(date: dayjs.Dayjs): string {
  const m = date.month() + 1;
  return (m >= 4 && m <= 10) ? 'summer' : 'winter';
}

export default function VisitPage() {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const isNew = !id || id === 'new';
  const [form] = Form.useForm();
  const [visit, setVisit] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [equipmentTypes, setEquipmentTypes] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [addressOptions, setAddressOptions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [eqTypeMap, setEqTypeMap] = useState<Map<string, any>>(new Map());
  const [rmTypeMap, setRmTypeMap] = useState<Map<string, any>>(new Map());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalTab, setAddModalTab] = useState<string>('room');
  const [equipmentRooms, setEquipmentRooms] = useState<any[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [roomEquipment, setRoomEquipment] = useState<any[]>([]);
  const [roomEquipLoading, setRoomEquipLoading] = useState(false);
  const [selectedRoomEquipIds, setSelectedRoomEquipIds] = useState<string[]>([]);
  const [objectEquipment, setObjectEquipment] = useState<any[]>([]);
  const [objectEquipLoading, setObjectEquipLoading] = useState(false);
  const [selectedObjectEquipIds, setSelectedObjectEquipIds] = useState<string[]>([]);
  const [addingEquipment, setAddingEquipment] = useState(false);
  const [proposeEquipment, setProposeEquipment] = useState(true);
  const [newTaskForm] = Form.useForm();
  // Автоназначение заявок
  const [foundRequests, setFoundRequests] = useState<any[]>([]);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [pendingAddressId, setPendingAddressId] = useState<string | null>(null);
  const [autoAssignConfirmed, setAutoAssignConfirmed] = useState(false);
  const [mfrOptions, setMfrOptions] = useState<{ value: string; label: string }[]>([]);
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string }[]>([]);
  const [otherRoomsEquipment, setOtherRoomsEquipment] = useState<any[]>([]);
  const [otherRoomsLoading, setOtherRoomsLoading] = useState(false);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [newRoomMode, setNewRoomMode] = useState(false);
  const [newRoomTypeCode, setNewRoomTypeCode] = useState<string | null>(null);
  const [newRoomObjectEquipment, setNewRoomObjectEquipment] = useState<any[]>([]);
  const [newRoomSelectedEquipIds, setNewRoomSelectedEquipIds] = useState<string[]>([]);
  const [newRoomTransferring, setNewRoomTransferring] = useState(false);

  const handleAutoSave = useCallback(async () => {
    if (isNew) return;
    const values = form.getFieldsValue(true);
    if (!values.addressId) return;
    await api.updateVisit(id!, {
      addressId: values.addressId,
      engineerName: values.engineerName,
      dateStart: values.dateStart ? values.dateStart.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      timeStart: values.timeStart ? values.timeStart.format('HH:mm') : dayjs().format('HH:mm'),
      season: values.season,
    });
  }, [isNew, id, form]);

  const {
    isSaving: autoSaving,
    lastSavedAt,
    markDirty: markAutoSaveDirty,
    resetDirty: resetAutoSave,
  } = useAutoSave(handleAutoSave, {
    enabled: !isNew && !loading,
    isSubmitting: saving,
  });

  useEffect(() => {
    Promise.all([api.getEquipmentTypes(), api.getRoomTypes()]).then(([eq, rt]) => {
      setEquipmentTypes(eq);
      setRoomTypes(rt);
      setEqTypeMap(new Map(eq.map((e: any) => [e.code, e])));
      setRmTypeMap(new Map(rt.map((r: any) => [r.code, r])));
    });
    if (!isNew && id) {
      api.getVisit(id).then(async v => {
        // Автоматически переводим визит в "В работе" при первом посещении инженером
        if (user?.role === 'engineer' && ['planned', 'not_started', 'awaiting_assignment'].includes(v.status)) {
          await api.updateVisit(id, { status: 'in_progress' });
          v.status = 'in_progress';
        }
        setVisit(v);
        setTasks(v.tasks || []);
        form.setFieldsValue({
          addressId: v.addressId,
          addressSearch: v.address?.fullAddress || '',
          engineerName: user?.role === 'engineer' ? (user?.fullName || v.engineerName) : v.engineerName,
          dateStart: dayjs(v.dateStart),
          timeStart: dayjs(v.timeStart, 'HH:mm'),
          season: v.season,
        });
        resetAutoSave();
        setLoading(false);
      }).catch(err => {
        setLoading(false);
        message.error(err.message || 'Не удалось загрузить визит');
        navigate('/requests');
      });
    } else {
      const now = dayjs();
      form.setFieldsValue({
        dateStart: now,
        timeStart: now,
        season: determineSeason(now),
        engineerName: localStorage.getItem('lastEngineerName') || user?.fullName || '',
      });
      setLoading(false);
    }
  }, [id]);

  // Перезагрузка задач при возвращении из задачи (после сохранения)
  useEffect(() => {
    console.log('[VisitPage] useEffect refreshTasks:', { isNew, id, visit: !!visit, locationState: location.state });
    if (!isNew && id && visit && (location.state as any)?.refreshTasks) {
      console.log('[VisitPage] Refreshing tasks...');
      api.getVisit(id).then(v => {
        console.log('[VisitPage] Tasks refreshed:', v.tasks?.length, 'tasks');
        setTasks(v.tasks || []);
      });
      // Очищаем флаг, чтобы не перезагружать при каждом рендере
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [id, isNew, visit, location.state, location.pathname, navigate]);

  const searchAddresses = async (q: string) => {
    if (q.length >= 2) {
      const results = await api.searchAddresses(q);
      setAddressOptions(results);
    }
  };

  // Проверка наличия заявок по адресу для автоназначения
  const checkRequestsByAddress = async (addressId: string) => {
    if (!isNew || !user || user.role !== 'engineer') return;
    
    try {
      const result = await api.checkRequestsByAddress(addressId);
      if (result.canAutoAssign && result.requests?.length > 0) {
        setFoundRequests(result.requests);
        setPendingAddressId(addressId);
        setRequestsModalOpen(true);
      } else {
        // Нет заявок — просто устанавливаем адрес
        form.setFieldValue('addressId', addressId);
      }
    } catch (err) {
      // При ошибке — просто устанавливаем адрес
      form.setFieldValue('addressId', addressId);
    }
  };

  // Подтверждение автоназначения
  const handleConfirmAutoAssign = () => {
    if (pendingAddressId) {
      form.setFieldValue('addressId', pendingAddressId);
      setAutoAssignConfirmed(true);
    }
    setRequestsModalOpen(false);
  };

  // Отмена автоназначения
  const handleCancelAutoAssign = () => {
    if (pendingAddressId) {
      form.setFieldValue('addressId', pendingAddressId);
      setAutoAssignConfirmed(false);
    }
    setRequestsModalOpen(false);
    setFoundRequests([]);
  };

  const handleDateChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      form.setFieldValue('season', determineSeason(date));
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const data: any = {
        addressId: values.addressId,
        engineerName: values.engineerName,
        dateStart: values.dateStart.format('YYYY-MM-DD'),
        timeStart: values.timeStart ? values.timeStart.format('HH:mm') : dayjs().format('HH:mm'),
        season: values.season,
      };
      
      // Добавляем флаг автоназначения, если подтверждено
      if (isNew && autoAssignConfirmed) {
        data.autoAssignRequests = true;
      }
      
      localStorage.setItem('lastEngineerName', values.engineerName);

      if (isNew) {
        const v = isOffline() ? await api.createVisitOffline(data) : await api.createVisit(data);
        setVisit(v);
        
        // Показываем уведомление о назначенных заявках
        if (v.autoAssignedRequests?.length > 0) {
          message.success(`Визит создан. Назначено заявок: ${v.autoAssignedRequests.length}`);
        } else {
          message.success(isOffline() ? 'Визит сохранён локально' : 'Визит создан');
        }
        
        // Сбрасываем флаг автоназначения
        setAutoAssignConfirmed(false);
        setFoundRequests([]);
        
        navigate(`/visit/${v.id}`, { replace: true });
      } else {
        const v = await api.updateVisit(id!, data);
        setVisit(v);
        resetAutoSave();
        message.success('Сохранено');
      }
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadEquipmentRooms = useCallback(async (visitId: string, addressId: string) => {
    setRoomsLoading(true);
    try {
      const rooms = await api.getEquipmentRooms(addressId, { exclude_visit_id: visitId });
      setEquipmentRooms(rooms);
    } catch { /* ignore */ }
    setRoomsLoading(false);
  }, []);

  const loadRoomEquipment = useCallback(async (addressId: string, roomTypeCode: string, visitId: string) => {
    setRoomEquipLoading(true);
    try {
      const eq = await api.getObjectEquipment(addressId, { exclude_visit_id: visitId, binding_level: 'room', room_type_code: roomTypeCode });
      setRoomEquipment(eq);
      setSelectedRoomEquipIds(eq.map((e: any) => e.id));
    } catch { /* ignore */ }
    setRoomEquipLoading(false);
  }, []);

  const loadObjectEquipment = useCallback(async (addressId: string, visitId: string) => {
    setObjectEquipLoading(true);
    try {
      const eq = await api.getObjectEquipment(addressId, { exclude_visit_id: visitId, binding_level: 'object' });
      setObjectEquipment(eq);
      setSelectedObjectEquipIds(eq.map((e: any) => e.id));
    } catch { /* ignore */ }
    setObjectEquipLoading(false);
  }, []);

  const loadOtherRoomsEquipment = useCallback(async (addressId: string, currentRoomTypeCode: string, visitId: string) => {
    setOtherRoomsLoading(true);
    try {
      const eq = await api.getOtherRoomsEquipment({
        address_id: addressId,
        current_room_type_code: currentRoomTypeCode,
        exclude_visit_id: visitId,
      });
      setOtherRoomsEquipment(eq);
    } catch { /* ignore */ }
    setOtherRoomsLoading(false);
  }, []);

  const handleTransferEquipment = useCallback(async (equipmentId: string, newRoomTypeCode: string) => {
    setTransferringId(equipmentId);
    try {
      await api.createRoomChangeProposal({
        objectEquipmentId: equipmentId,
        newRoomTypeCode,
      });
      message.success('Запрос на перенос отправлен. Оборудование сразу доступно в этом помещении.');
      // Обновляем список — оборудование теперь в текущем помещении
      if (visit?.addressId && visit?.id) {
        await loadOtherRoomsEquipment(visit.addressId, newRoomTypeCode, visit.id);
        // Перезагрузить оборудование текущего помещения
        await loadRoomEquipment(visit.addressId, newRoomTypeCode, visit.id);
      }
    } catch (err: any) {
      message.error(err.message || 'Ошибка переноса');
    }
    setTransferringId(null);
  }, [visit, message, loadOtherRoomsEquipment, loadRoomEquipment]);

  const handleCreateRoomAndTransfer = useCallback(async () => {
    if (!newRoomTypeCode || newRoomSelectedEquipIds.length === 0) return;
    setNewRoomTransferring(true);
    try {
      // Переносим каждое выбранное оборудование в новое помещение
      for (const eqId of newRoomSelectedEquipIds) {
        await api.createRoomChangeProposal({
          objectEquipmentId: eqId,
          newRoomTypeCode,
        });
      }
      message.success(`Оборудование (${newRoomSelectedEquipIds.length} шт.) перенесено в помещение "${rmTypeMap.get(newRoomTypeCode)?.name || newRoomTypeCode}"`);
      // Сбрасываем состояние
      setNewRoomMode(false);
      setNewRoomTypeCode(null);
      setNewRoomObjectEquipment([]);
      setNewRoomSelectedEquipIds([]);
      // Обновляем списки
      if (visit?.addressId && visit?.id) {
        await loadEquipmentRooms(visit.addressId, visit.id);
        await loadObjectEquipment(visit.addressId, visit.id);
      }
    } catch (err: any) {
      message.error(err.message || 'Ошибка переноса');
    }
    setNewRoomTransferring(false);
  }, [newRoomTypeCode, newRoomSelectedEquipIds, rmTypeMap, message, visit, loadEquipmentRooms, loadObjectEquipment]);

  const handleSelectNewRoomType = useCallback(async (roomTypeCode: string) => {
    setNewRoomTypeCode(roomTypeCode);
    // Загружаем всё оборудование объекта для переноса (включая из других помещений)
    if (visit?.addressId && visit?.id) {
      const eq = await api.getObjectEquipment(visit.addressId, { exclude_visit_id: visit.id });
      setNewRoomObjectEquipment(eq);
    }
  }, [visit]);

  const handleOpenAddModal = useCallback(async () => {
    let currentVisit = visit;
    if (!currentVisit?.id) {
      try {
        const values = await form.validateFields();
        setSaving(true);
        const data = {
          addressId: values.addressId,
          engineerName: values.engineerName,
          dateStart: values.dateStart.format('YYYY-MM-DD'),
          timeStart: values.timeStart ? values.timeStart.format('HH:mm') : dayjs().format('HH:mm'),
          season: values.season,
        };
        localStorage.setItem('lastEngineerName', values.engineerName);
        const v = isOffline() ? await api.createVisitOffline(data) : await api.createVisit(data);
        setVisit(v);
        navigate(`/visit/${v.id}`, { replace: true });
        currentVisit = v;
        setSaving(false);
      } catch (err: any) {
        setSaving(false);
        if (err.errorFields) return;
        message.error(err.message || 'Ошибка сохранения визита');
        return;
      }
    }
    setAddModalOpen(true);
    setAddModalTab('room');
    setSelectedRoom(null);
    setRoomEquipment([]);
    setSelectedRoomEquipIds([]);
    setObjectEquipment([]);
    setSelectedObjectEquipIds([]);
    setOtherRoomsEquipment([]);
    await loadEquipmentRooms(currentVisit.id, currentVisit.addressId);
    await loadObjectEquipment(currentVisit.addressId, currentVisit.id);
  }, [visit, form, navigate, loadEquipmentRooms, loadObjectEquipment, message]);

  const handleSelectRoom = useCallback(async (roomCode: string) => {
    setSelectedRoom(roomCode);
    if (visit?.addressId && visit?.id) {
      await loadRoomEquipment(visit.addressId, roomCode, visit.id);
      await loadOtherRoomsEquipment(visit.addressId, roomCode, visit.id);
    }
  }, [visit, loadRoomEquipment, loadOtherRoomsEquipment]);

  const CLIMATE_INDOOR_CODES = ['splitvn', 'mssvn', 'vrv_vn'];
  const CLIMATE_OUTDOOR_CODES = ['splitnar', 'mssnar', 'vrv_nar'];

  const handleAddEquipmentBatch = useCallback(async (equipIds: string[], equipment: any[]) => {
    if (!visit?.id || equipIds.length === 0) return;
    setAddingEquipment(true);
    try {
      // Разделяем оборудование на климатическое (внутренние блоки) и остальное
      const climateIndoor: any[] = [];
      const otherEquipment: any[] = [];

      for (const eqId of equipIds) {
        const eq = equipment.find(e => e.id === eqId);
        if (!eq) continue;
        if (CLIMATE_INDOOR_CODES.includes(eq.equipmentTypeCode)) {
          climateIndoor.push(eq);
        } else {
          otherEquipment.push(eq);
        }
      }

      // Для климатического оборудования — одна групповая задача на помещение
      if (climateIndoor.length > 0) {
        const firstEq = climateIndoor[0];
        const eqType = eqTypeMap.get(firstEq.equipmentTypeCode);
        const rmType = firstEq.roomTypeCode ? rmTypeMap.get(firstEq.roomTypeCode) : null;

        const taskData = {
          taskType: 'group_climate' as const,
          equipmentTypeId: eqType?.id || '',
          roomTypeId: rmType?.id || '',
          roomTypeCode: firstEq.roomTypeCode || '',
          equipmentItemIds: climateIndoor.map(eq => eq.id),
        };
        await api.createTask(visit.id, taskData);
      }

      // Для остального оборудования — индивидуальные задачи
      for (const eq of otherEquipment) {
        const eqType = eqTypeMap.get(eq.equipmentTypeCode);
        const rmType = eq.roomTypeCode ? rmTypeMap.get(eq.roomTypeCode) : null;
        const taskData = {
          equipmentTypeId: eqType?.id || '',
          roomTypeId: rmType?.id || '',
          objectEquipmentId: eq.id,
          comment: eq.locationDescription || '',
          brand: eq.brand || '',
          model: eq.model || '',
          serialNumber: eq.serialNumber || '',
        };
        if (isOffline()) {
          await api.createTaskOffline(visit.id, taskData);
        } else {
          await api.createTask(visit.id, taskData);
        }
      }

      const v = await api.getVisit(visit.id);
      setTasks(v.tasks || []);
      setAddModalOpen(false);
      const totalTasks = (climateIndoor.length > 0 ? 1 : 0) + otherEquipment.length;
      message.success(`Добавлено задач: ${totalTasks}`);
    } catch (err: any) {
      message.error(err.message || 'Ошибка добавления');
    }
    setAddingEquipment(false);
  }, [visit, eqTypeMap, rmTypeMap, message]);

  const handleAddNewTask = async (values: any) => {
    if (!visit?.id) { message.warning('Сначала сохраните визит'); return; }
    if (!values.roomTypeId && !values.comment) {
      message.warning('Укажите тип помещения или комментарий');
      return;
    }
    const taskData = {
      equipmentTypeId: values.equipmentTypeId,
      roomTypeId: values.roomTypeId || '',
      comment: values.comment || '',
      brand: values.brand || '',
      model: values.model || '',
      serialNumber: values.serialNumber || '',
    };
    if (isOffline()) {
      await api.createTaskOffline(visit.id, taskData);
    } else {
      await api.createTask(visit.id, taskData);
    }

    if (proposeEquipment && !isOffline()) {
      const eqType = equipmentTypes.find(e => e.id === values.equipmentTypeId);
      const rmType = roomTypes.find(r => r.id === values.roomTypeId);
      try {
        await api.createProposal({
          addressId: visit.addressId,
          equipmentTypeCode: eqType?.code || '',
          roomTypeCode: rmType?.code || '',
          brand: values.brand || '',
          model: values.model || '',
          serialNumber: values.serialNumber || '',
          locationDescription: values.comment || '',
        });
        message.success('Предложение отправлено администратору');
      } catch {
        message.warning('Задача создана, но предложение не удалось отправить');
      }
    }

    const v = await api.getVisit(visit.id);
    setTasks(v.tasks || []);
    setAddModalOpen(false);
    setProposeEquipment(false);
    newTaskForm.resetFields();
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!visit?.id) return;
    await api.deleteTask(visit.id, taskId);
    const v = await api.getVisit(visit.id);
    setTasks(v.tasks || []);
    message.success('Задача удалена');
  };

  const handleComplete = async () => {
    if (!visit?.id) return;
    const completedTasks = tasks.filter(t => t.status === 'completed');
    if (completedTasks.length === 0) { message.warning('Должна быть хотя бы 1 выполненная задача'); return; }
    if (isOffline()) {
      await api.completeVisitOffline(visit.id);
    } else {
      await api.completeVisit(visit.id);
    }
    navigate(`/visit/${visit.id}/report`);
  };

  const handleDeleteVisit = async () => {
    if (!visit?.id) return;
    if (isOffline()) {
      await api.deleteVisitOffline(visit.id);
    } else {
      await api.deleteVisit(visit.id);
    }
    navigate('/');
  };

  const getPhotoProgress = (task: any) => {
    if (task.taskType === 'group_climate') {
      const items = task.equipmentItems || [];
      const totalPhotos = items.reduce((sum: number, item: any) => sum + (item.photos?.length || 0), 0);
      const required = items.length * 2;
      return `${totalPhotos}/${required}`;
    }
    const photos = task.photos || [];
    const required = task.equipmentType?.photosRequired || 1;
    return `${photos.length}/${required}`;
  };

  const columns = [
    {
      title: 'Оборудование',
      dataIndex: ['equipmentType', 'name'],
      key: 'equipment',
      render: (_: any, r: any) => {
        if (r.taskType === 'group_climate') {
          const items = r.equipmentItems || [];
          return (
            <div>
              <span style={{ fontWeight: 500 }}>🌡 Климатическое оборудование</span>
              <div style={{ fontSize: 12, color: '#666' }}>
                Единиц: {items.length}
                {items.length > 0 && (() => {
                  const okCount = items.filter((i: any) => i.status === 'ok').length;
                  const notOkCount = items.filter((i: any) => i.status === 'not_ok').length;
                  return (
                    <>
                      {okCount > 0 && <span style={{ color: '#52c41a' }}> · ✅ {okCount}</span>}
                      {notOkCount > 0 && <span style={{ color: '#ff4d4f' }}> · ⚠️ {notOkCount}</span>}
                    </>
                  );
                })()}
              </div>
            </div>
          );
        }
        return <span style={{ fontWeight: 500 }}>{r.equipmentType?.name}</span>;
      },
    },
    {
      title: 'Местоположение',
      key: 'comment',
      render: (_: any, r: any) => r.roomType?.name || r.comment || '—',
    },
    {
      title: 'Фото',
      key: 'photos',
      width: 80,
      render: (_: any, r: any) => <span className="photo-progress">📷 {getPhotoProgress(r)}</span>,
    },
    {
      title: 'Статус',
      key: 'status',
      width: 110,
      render: (_: any, r: any) => {
        const st = STATUS_MAP[r.status] || STATUS_MAP.not_started;
        return <Tag color={st.color}>{st.label}</Tag>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, r: any) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Popconfirm title="Удалить задачу?" onConfirm={() => handleDeleteTask(r.id)} okText="Да" cancelText="Нет">
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </span>
      ),
    },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;

  // Группировка задач по комнатам для мобильного вида
  const tasksByRoom = isMobile ? (() => {
    const groups = new Map<string, { roomName: string; tasks: any[] }>();
    for (const task of tasks) {
      const roomKey = task.roomTypeCode || task.room_type_id || task.roomType?.name || 'Без помещения';
      const roomName = task.roomType?.name || task.comment || 'Без помещения';
      if (!groups.has(roomKey)) {
        groups.set(roomKey, { roomName, tasks: [] });
      }
      groups.get(roomKey)!.tasks.push(task);
    }
    return Array.from(groups.entries()).map(([key, val]) => ({ key, ...val }));
  })() : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined className="status-icon status-icon-completed" aria-label="Выполнено" />;
      case 'in_progress':
        return <SyncOutlined className="status-icon status-icon-in-progress" aria-label="В работе" />;
      default:
        return <ClockCircleOutlined className="status-icon status-icon-not-started" aria-label="Не начато" />;
    }
  };

  const navigateToTask = (record: any) => {
    if (visit?.id) {
      // Для виртуальных задач — переходим к первой реальной задаче, передавая все ID группы
      if (record._sourceTaskIds && record._sourceTaskIds.length > 0) {
        const firstTaskId = record._sourceTaskIds[0];
        navigate(`/visit/${visit.id}/task/${firstTaskId}/group`, {
          state: { sourceTaskIds: record._sourceTaskIds }
        });
      } else if (record.taskType === 'group_climate') {
        navigate(`/visit/${visit.id}/task/${record.id}/group`);
      } else {
        navigate(`/visit/${visit.id}/task/${record.id}`);
      }
    }
  };

  // Виртуальная группировка: splitvn/mssvn/vrv_vn группируем по помещениям в group_climate
  const CLIMATE_CODES = ['splitvn', 'mssvn', 'vrv_vn'];
  const displayTasks = (() => {
    const climateByRoom = new Map<string, { room: any; tasks: any[] }>();
    const otherTasks: any[] = [];
    
    for (const task of tasks) {
      const eqCode = task.equipmentType?.code || '';
      if (CLIMATE_CODES.includes(eqCode) && task.taskType !== 'group_climate') {
        // Индивидуальная задача климатического оборудования — группируем по помещению
        const roomCode = task.roomType?.code || task.roomTypeCode || '';
        const roomKey = roomCode || task.roomTypeId || task.room_type_id || '__no_room__';
        const room = task.roomType || { code: roomCode, name: task.roomType?.name || 'Без помещения' };
        if (!climateByRoom.has(roomKey)) {
          climateByRoom.set(roomKey, { room, tasks: [] });
        }
        climateByRoom.get(roomKey)!.tasks.push(task);
      } else {
        otherTasks.push(task);
      }
    }
    
    // Создаём виртуальные group_climate задачи для каждой группы
    const virtualClimateTasks = Array.from(climateByRoom.entries()).map(([roomKey, { room, tasks: roomTasks }]) => {
      // Вычисляем статус виртуальной задачи на основе статусов реальных задач
      const allCompleted = roomTasks.every(t => t.status === 'completed');
      const anyInProgress = roomTasks.some(t => t.status === 'in_progress');
      const virtualStatus = allCompleted ? 'completed' : anyInProgress ? 'in_progress' : 'not_started';

      return {
        id: `virtual_climate_${roomKey}`,
        taskType: 'group_climate' as const,
        equipmentType: { name: 'Климатическое оборудование', code: 'climate' },
        roomType: room,
        status: virtualStatus,
        equipmentItems: roomTasks.map(t => ({
          id: t.id,
          objectEquipmentId: t.objectEquipmentId,
          status: t.conclusion === 'ok' ? 'ok' : t.conclusion === 'faulty' ? 'not_ok' : null,
          photos: t.photos || [],
          _sourceTaskId: t.id, // Для навигации
        })),
        _virtualRoomKey: roomKey,
        _sourceTaskIds: roomTasks.map(t => t.id), // Для навигации
      };
    });
    
    return [...virtualClimateTasks, ...otherTasks];
  })();

  return (
    <div className={`page-container${isMobile ? ' page-with-bottom-nav' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Назад</Button>
        <div className="page-title" style={{ margin: 0, flex: 1 }}>
          {isNew ? 'Новый визит' : 'Визит'}
          {!isNew && visit?.importedRequests?.length > 0 && (
            <Tag color="green" style={{ marginLeft: 8, fontSize: 13 }}>{visit.importedRequests[0].externalRequestId}</Tag>
          )}
        </div>
        <NotificationBell />
        <TorchButton />
      </div>

      <div style={{ background: '#fff', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <Form form={form} layout="vertical" onValuesChange={markAutoSaveDirty}>
          <Form.Item label="Инженер" name="engineerName" rules={[{ required: true, message: 'Введите ФИО' }]}>
            <Input placeholder="Иванов П.С." />
          </Form.Item>
          <Form.Item label="Адрес" name="addressSearch" rules={[{ required: true, message: 'Выберите адрес' }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={searchAddresses}
              placeholder="Начните вводить адрес..."
              onChange={(v: string) => {
                if (isNew && user?.role === 'engineer') {
                  checkRequestsByAddress(v);
                } else {
                  form.setFieldValue('addressId', v);
                }
              }}
              options={addressOptions.map((a: any) => ({ label: a.objectCode ? `[${a.objectCode}] ${a.fullAddress}` : a.fullAddress, value: a.id, dataId: a.id }))}
              notFoundContent="Адрес не найден"
            />
          </Form.Item>
          <Form.Item name="addressId" hidden><Input /></Form.Item>
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item label="Дата" name="dateStart" rules={[{ required: true }]}>
              <DatePicker format="DD.MM.YYYY" onChange={handleDateChange} />
            </Form.Item>
            <Form.Item label="Время" name="timeStart" rules={[{ required: true }]}>
              <TimePicker format="HH:mm" />
            </Form.Item>
            <Form.Item label="Сезон" name="season" rules={[{ required: true }]}>
              <Select style={{ width: 120 }} options={[{ label: 'Лето', value: 'summer' }, { label: 'Зима', value: 'winter' }]} />
            </Form.Item>
          </Space>
        </Form>
        <Space>
          <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />}>Сохранить</Button>
          {!isNew && (autoSaving || lastSavedAt) && (
            <span style={{ fontSize: 12, color: '#999' }}>
              {autoSaving ? 'Автосохранение...' : `Сохранено ${dayjs(lastSavedAt).fromNow()}`}
            </span>
          )}
          {!isNew && visit && (
            <Popconfirm title="Удалить визит?" onConfirm={handleDeleteVisit} okText="Да" cancelText="Нет">
              <Button danger>Удалить визит</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Проведённые работы</div>
        <Button type="dashed" icon={<PlusOutlined />} onClick={handleOpenAddModal}>Добавить оборудование</Button>
      </div>

      {!isMobile ? (
        <Table
          dataSource={displayTasks}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          onRow={(record) => ({
            onClick: () => navigateToTask(record),
            style: { cursor: 'pointer' },
          })}
        />
      ) : (
        <div className="mobile-task-list">
          {tasksByRoom.length === 0 ? (
            <Empty description="Нет задач" />
          ) : (
            tasksByRoom.map((group) => (
              <div key={group.key} className="room-group">
                <div className="room-group-header">
                  📍 {group.roomName}
                </div>
                {group.tasks.map((task: any) => {
                  const eqName = task.taskType === 'group_climate'
                    ? '🌡 Климатическое оборудование'
                    : (task.equipmentType?.name || 'Оборудование');
                  const subtitle = task.taskType === 'group_climate'
                    ? `Единиц: ${(task.equipmentItems || []).length}`
                    : [task.roomType?.name, task.equipmentType?.name].filter(Boolean).join(' · ');
                  const overflowItems = [
                    { key: 'edit', label: 'Редактировать', icon: <EditOutlined /> },
                    { key: 'delete', label: 'Удалить', icon: <DeleteOutlined />, danger: true },
                    { key: 'photos', label: 'Перейти к фото', icon: <PictureOutlined /> },
                  ];
                  return (
                    <div
                      key={task.id}
                      className="task-card"
                      onClick={() => navigateToTask(task)}
                    >
                      <div className="task-card-content">
                        <div className="task-card-title">{eqName}</div>
                        <div className="task-card-subtitle">{subtitle}</div>
                      </div>
                      <div className="task-card-meta">
                        <span className="photo-progress">
                          <CameraOutlined /> {getPhotoProgress(task)}
                        </span>
                        {getStatusIcon(task.status)}
                        <span onClick={(e) => e.stopPropagation()}>
                          <Dropdown
                            menu={{
                              items: overflowItems,
                              onClick: ({ key }) => {
                                if (key === 'edit') navigateToTask(task);
                                else if (key === 'delete') {
                                  Modal.confirm({
                                    title: 'Удалить задачу?',
                                    okText: 'Да',
                                    cancelText: 'Нет',
                                    onOk: () => handleDeleteTask(task.id),
                                  });
                                }
                                else if (key === 'photos') navigateToTask(task);
                              },
                            }}
                            trigger={['click']}
                          >
                            <EllipsisOutlined style={{ fontSize: 18, padding: '0 4px' }} />
                          </Dropdown>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {visit && (
        <div style={{ marginTop: 16 }}>
          <Button type="primary" size="large" icon={<CheckOutlined />} onClick={handleComplete} disabled={tasks.filter(t => t.status === 'completed').length === 0} block>
            ✅ Завершить визит
          </Button>
        </div>
      )}

      <Modal
        title="Добавление оборудования"
        open={addModalOpen}
        onCancel={() => { setAddModalOpen(false); newTaskForm.resetFields(); setProposeEquipment(false); setSelectedRoom(null); setNewRoomMode(false); setNewRoomTypeCode(null); setNewRoomObjectEquipment([]); setNewRoomSelectedEquipIds([]); }}
        footer={null}
        width={600}
      >
        <Tabs activeKey={addModalTab} onChange={setAddModalTab} items={[
          {
            key: 'room',
            label: '📍 Уровень помещения',
            children: roomsLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : newRoomMode ? (
              // Режим создания нового помещения
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Button size="small" onClick={() => { setNewRoomMode(false); setNewRoomTypeCode(null); setNewRoomObjectEquipment([]); setNewRoomSelectedEquipIds([]); }}>
                    ← Назад
                  </Button>
                  <span style={{ fontWeight: 500 }}>Создать помещение</span>
                </div>
                {!newRoomTypeCode ? (
                  <>
                    <div style={{ marginBottom: 12 }}>Выберите тип помещения:</div>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Выберите тип помещения"
                      onChange={handleSelectNewRoomType}
                      options={roomTypes.map((rt: any) => ({ value: rt.code, label: rt.name }))}
                    />
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      Помещение: <Tag color="green">{rmTypeMap.get(newRoomTypeCode)?.name || newRoomTypeCode}</Tag>
                    </div>
                    {newRoomObjectEquipment.length === 0 ? (
                      <Empty description="Нет оборудования на объекте" />
                    ) : (
                      <>
                        <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
                          Выберите оборудование для переноса в новое помещение:
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <Checkbox
                            checked={newRoomSelectedEquipIds.length === newRoomObjectEquipment.length}
                            onChange={(e) => setNewRoomSelectedEquipIds(e.target.checked ? newRoomObjectEquipment.map(eq => eq.id) : [])}
                          >
                            Выбрать все ({newRoomObjectEquipment.length})
                          </Checkbox>
                        </div>
                        <List
                          size="small"
                          bordered
                          dataSource={newRoomObjectEquipment}
                          style={{ maxHeight: 300, overflowY: 'auto' }}
                          renderItem={(eq: any) => {
                            const eqType = eqTypeMap.get(eq.equipmentTypeCode);
                            const checked = newRoomSelectedEquipIds.includes(eq.id);
                            return (
                              <List.Item
                                style={{ cursor: 'pointer', padding: '8px 4px' }}
                                onClick={() => {
                                  if (checked) setNewRoomSelectedEquipIds(newRoomSelectedEquipIds.filter(id => id !== eq.id));
                                  else setNewRoomSelectedEquipIds([...newRoomSelectedEquipIds, eq.id]);
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                  <Checkbox checked={checked} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>
                                      {eqType?.name || eq.equipmentTypeCode}
                                      {eq.brand && <span style={{ color: '#666', fontWeight: 400 }}> · {eq.brand} {eq.model || ''}</span>}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#888' }}>
                                      {eq.roomTypeCode ? (
                                        <span>📍 {rmTypeMap.get(eq.roomTypeCode)?.name || eq.roomTypeCode}</span>
                                      ) : (
                                        <span>🏠 Уровень объекта</span>
                                      )}
                                      {eq.serialNumber && <span> · SN: {eq.serialNumber}</span>}
                                    </div>
                                  </div>
                                </div>
                              </List.Item>
                            );
                          }}
                        />
                        <Button
                          type="primary"
                          block
                          style={{ marginTop: 12 }}
                          disabled={newRoomSelectedEquipIds.length === 0}
                          loading={newRoomTransferring}
                          onClick={handleCreateRoomAndTransfer}
                        >
                          Перенести в помещение {newRoomSelectedEquipIds.length > 0 ? `(${newRoomSelectedEquipIds.length})` : ''}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </>
            ) : equipmentRooms.length === 0 ? (
              <Empty description="Нет доступных помещений с оборудованием">
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => setNewRoomMode(true)}>
                  Создать помещение
                </Button>
              </Empty>
            ) : (
              <>
                {!selectedRoom ? (
                  <>
                    <List
                      header={<div style={{ fontWeight: 500 }}>Выберите помещение:</div>}
                      bordered
                      dataSource={equipmentRooms}
                      renderItem={(room: any) => (
                        <List.Item
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSelectRoom(room.code)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <span>{room.name}</span>
                            <Tag>{room.count} ед.</Tag>
                          </div>
                        </List.Item>
                      )}
                    />
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      block
                      style={{ marginTop: 12 }}
                      onClick={() => setNewRoomMode(true)}
                    >
                      Создать новое помещение
                    </Button>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Button size="small" onClick={() => { setSelectedRoom(null); setRoomEquipment([]); setSelectedRoomEquipIds([]); }}>
                        ← Назад
                      </Button>
                      <span style={{ fontWeight: 500 }}>
                        {rmTypeMap.get(selectedRoom)?.name || selectedRoom}
                      </span>
                    </div>
                    {roomEquipLoading ? (
                      <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
                    ) : roomEquipment.length === 0 ? (
                      <Empty description="Нет оборудования в этом помещении" />
                    ) : (
                      <>
                        <div style={{ marginBottom: 8 }}>
                          <Checkbox
                            checked={selectedRoomEquipIds.length === roomEquipment.length}
                            onChange={(e) => setSelectedRoomEquipIds(e.target.checked ? roomEquipment.map(eq => eq.id) : [])}
                          >
                            Выбрать все ({roomEquipment.length})
                          </Checkbox>
                        </div>
                        <List
                          dataSource={roomEquipment}
                          renderItem={(eq: any) => {
                            const eqType = eqTypeMap.get(eq.equipmentTypeCode);
                            const checked = selectedRoomEquipIds.includes(eq.id);
                            return (
                              <List.Item
                                style={{ cursor: 'pointer', padding: '8px 4px' }}
                                onClick={() => {
                                  if (checked) setSelectedRoomEquipIds(selectedRoomEquipIds.filter(id => id !== eq.id));
                                  else setSelectedRoomEquipIds([...selectedRoomEquipIds, eq.id]);
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                  <Checkbox checked={checked} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>
                                      {eqType?.name || eq.equipmentTypeCode}
                                      {(eq.brand || eq.model) && <span style={{ color: '#666', fontWeight: 400 }}> · {eq.brand}{eq.brand && eq.model ? ' ' : ''}{eq.model}</span>}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#888' }}>
                                      {eq.serialNumber && <span>SN: {eq.serialNumber}</span>}
                                    </div>
                                  </div>
                                </div>
                              </List.Item>
                            );
                          }}
                        />
                        <Button
                          type="primary"
                          block
                          style={{ marginTop: 12 }}
                          disabled={selectedRoomEquipIds.length === 0}
                          loading={addingEquipment}
                          onClick={() => handleAddEquipmentBatch(selectedRoomEquipIds, roomEquipment)}
                        >
                          Добавить {selectedRoomEquipIds.length > 0 ? `(${selectedRoomEquipIds.length})` : ''}
                        </Button>
                      </>
                    )}

                    {/* Оборудование из других помещений */}
                    {otherRoomsLoading ? (
                      <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
                    ) : otherRoomsEquipment.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontWeight: 500, marginBottom: 8, color: '#666', fontSize: 13 }}>
                          🔄 Оборудование из других помещений ({otherRoomsEquipment.length}):
                        </div>
                        <List
                          size="small"
                          bordered
                          dataSource={otherRoomsEquipment}
                          renderItem={(eq: any) => {
                            const eqType = eqTypeMap.get(eq.equipmentTypeCode);
                            const roomName = eq.roomType?.name || eq.roomTypeCode || '—';
                            return (
                              <List.Item style={{ padding: '8px 12px' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 500, fontSize: 13 }}>
                                    {eqType?.name || eq.equipmentTypeCode}
                                    {(eq.brand || eq.model) && <span style={{ color: '#666', fontWeight: 400 }}> · {eq.brand}{eq.brand && eq.model ? ' ' : ''}{eq.model}</span>}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#888' }}>
                                    📍 {roomName}
                                    {eq.serialNumber && <span> · SN: {eq.serialNumber}</span>}
                                  </div>
                                </div>
                                <Button
                                  size="small"
                                  type="dashed"
                                  loading={transferringId === eq.id}
                                  disabled={eq.hasPendingProposal}
                                  onClick={() => handleTransferEquipment(eq.id, selectedRoom!)}
                                >
                                  {eq.hasPendingProposal ? '⏳ Ожидает' : `🔄 Перенести`}
                                </Button>
                              </List.Item>
                            );
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            ),
          },
          {
            key: 'object',
            label: '🏠 Уровень объекта',
            children: objectEquipLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : objectEquipment.length === 0 ? (
              <Empty description="Нет оборудования на уровне объекта" />
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Checkbox
                    checked={selectedObjectEquipIds.length === objectEquipment.length}
                    onChange={(e) => setSelectedObjectEquipIds(e.target.checked ? objectEquipment.map(eq => eq.id) : [])}
                  >
                    Выбрать все ({objectEquipment.length})
                  </Checkbox>
                </div>
                <List
                  dataSource={objectEquipment}
                  renderItem={(eq: any) => {
                    const eqType = eqTypeMap.get(eq.equipmentTypeCode);
                    const checked = selectedObjectEquipIds.includes(eq.id);
                    return (
                      <List.Item
                        style={{ cursor: 'pointer', padding: '8px 4px' }}
                        onClick={() => {
                          if (checked) setSelectedObjectEquipIds(selectedObjectEquipIds.filter(id => id !== eq.id));
                          else setSelectedObjectEquipIds([...selectedObjectEquipIds, eq.id]);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                          <Checkbox checked={checked} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>
                              {eqType?.name || eq.equipmentTypeCode}
                              {eq.brand && <span style={{ color: '#666', fontWeight: 400 }}> · {eq.brand} {eq.model || ''}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#888' }}>
                              {eq.serialNumber && <span>SN: {eq.serialNumber}</span>}
                              {eq.locationDescription && <span>{eq.locationDescription}</span>}
                            </div>
                          </div>
                        </div>
                      </List.Item>
                    );
                  }}
                />
                <Button
                  type="primary"
                  block
                  style={{ marginTop: 12 }}
                  disabled={selectedObjectEquipIds.length === 0}
                  loading={addingEquipment}
                  onClick={() => handleAddEquipmentBatch(selectedObjectEquipIds, objectEquipment)}
                >
                  Добавить {selectedObjectEquipIds.length > 0 ? `(${selectedObjectEquipIds.length})` : ''}
                </Button>
              </>
            ),
          },
          {
            key: 'new',
            label: <span><PlusOutlined /> Добавить новое</span>,
            children: (
              <Form form={newTaskForm} layout="vertical" onFinish={handleAddNewTask}>
                <Form.Item name="equipmentTypeId" label="Вид оборудования" rules={[{ required: true, message: 'Выберите вид оборудования' }]}>
                  <Select placeholder="Выберите..." options={equipmentTypes.map(e => ({ label: e.name, value: e.id }))} />
                </Form.Item>
                <Form.Item name="roomTypeId" label="Тип помещения">
                  <Select placeholder="Выберите..." allowClear options={roomTypes.map(r => ({ label: r.name, value: r.id }))} />
                </Form.Item>
                <Form.Item name="comment" label="Комментарий">
                  <Input placeholder="Необязательно" />
                </Form.Item>
                <Form.Item name="brand" label="Производитель">
                  <AutoComplete
                    placeholder="Начните вводить..."
                    options={mfrOptions}
                    onSearch={async (q) => {
                      try {
                        const list = await api.getManufacturersList();
                        const filtered = list.filter((m: any) => m.name.toLowerCase().includes(q.toLowerCase()));
                        setMfrOptions(filtered.map((m: any) => ({ value: m.name, label: m.name })));
                      } catch { setMfrOptions([]); }
                    }}
                    onFocus={async () => {
                      if (mfrOptions.length === 0) {
                        try {
                          const list = await api.getManufacturersList();
                          setMfrOptions(list.map((m: any) => ({ value: m.name, label: m.name })));
                        } catch { /* ignore */ }
                      }
                    }}
                    filterOption={false}
                    allowClear
                  />
                </Form.Item>
                <Form.Item name="model" label="Модель">
                  <AutoComplete
                    placeholder="Начните вводить..."
                    options={modelOptions}
                    onSearch={async (q) => {
                      const eqTypeId = newTaskForm.getFieldValue('equipmentTypeId');
                      try {
                        const results = await api.searchModels({ equipment_type_id: eqTypeId, query: q });
                        setModelOptions(results.map((m: any) => ({
                          value: m.fullModelName || m.modelName,
                          label: `${m.fullModelName || m.modelName} (${m.manufacturer?.name || ''})`,
                        })));
                      } catch { setModelOptions([]); }
                    }}
                    filterOption={false}
                    allowClear
                  />
                </Form.Item>
                <Form.Item name="serialNumber" label="Серийный номер">
                  <Input placeholder="Необязательно" />
                </Form.Item>
                <Form.Item>
                  <Checkbox
                    checked={proposeEquipment}
                    onChange={(e) => setProposeEquipment(e.target.checked)}
                  >
                    Добавить в справочник оборудования объекта (на модерацию)
                  </Checkbox>
                </Form.Item>
                <Form.Item><Button type="primary" htmlType="submit" block>Добавить</Button></Form.Item>
              </Form>
            ),
          },
        ]} />
      </Modal>

      {/* Модальное окно подтверждения автоназначения заявок */}
      <Modal
        title="Найдены заявки по адресу"
        open={requestsModalOpen}
        onOk={handleConfirmAutoAssign}
        onCancel={handleCancelAutoAssign}
        okText="Назначить меня"
        cancelText="Не назначать"
        width={500}
      >
        <p>По выбранному адресу найдено заявок: <strong>{foundRequests.length}</strong></p>
        <p>Назначить вас на эти заявки автоматически?</p>
        <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 12, border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
          {foundRequests.map((r: any) => (
            <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ fontWeight: 500 }}>
                {r.externalRequestId} — {r.equipmentType?.name || r.equipmentType?.code}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                Статус: {r.visitStatus === 'awaiting_assignment' ? 'Ожидает назначения' : 'Запланирован'}
                {r.assignedEngineers?.length > 0 && ` · Инженеров: ${r.assignedEngineers.length}`}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
