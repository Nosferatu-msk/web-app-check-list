import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, Button, Table, Modal, Tag, Space, App, Popconfirm, DatePicker, TimePicker, Spin, Checkbox, Tabs, List, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, CheckOutlined, SaveOutlined } from '@ant-design/icons';
import { api, isOffline } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useAutoSave } from '../hooks/useAutoSave';
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
  const { user } = useAuthStore();
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
  const [proposeEquipment, setProposeEquipment] = useState(false);
  const [newTaskForm] = Form.useForm();

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
      api.getVisit(id).then(v => {
        setVisit(v);
        setTasks(v.tasks || []);
        form.setFieldsValue({
          addressId: v.addressId,
          addressSearch: v.address?.fullAddress || '',
          engineerName: v.engineerName,
          dateStart: dayjs(v.dateStart),
          timeStart: dayjs(v.timeStart, 'HH:mm'),
          season: v.season,
        });
        resetAutoSave();
        setLoading(false);
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

  const searchAddresses = async (q: string) => {
    if (q.length >= 2) {
      const results = await api.searchAddresses(q);
      setAddressOptions(results);
    }
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
      const data = {
        addressId: values.addressId,
        engineerName: values.engineerName,
        dateStart: values.dateStart.format('YYYY-MM-DD'),
        timeStart: values.timeStart ? values.timeStart.format('HH:mm') : dayjs().format('HH:mm'),
        season: values.season,
      };
      localStorage.setItem('lastEngineerName', values.engineerName);

      if (isNew) {
        const v = isOffline() ? await api.createVisitOffline(data) : await api.createVisit(data);
        setVisit(v);
        navigate(`/visit/${v.id}`, { replace: true });
        message.success(isOffline() ? 'Визит сохранён локально' : 'Визит создан');
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
    await loadEquipmentRooms(currentVisit.id, currentVisit.addressId);
    await loadObjectEquipment(currentVisit.addressId, currentVisit.id);
  }, [visit, form, navigate, loadEquipmentRooms, loadObjectEquipment, message]);

  const handleSelectRoom = useCallback(async (roomCode: string) => {
    setSelectedRoom(roomCode);
    if (visit?.addressId && visit?.id) {
      await loadRoomEquipment(visit.addressId, roomCode, visit.id);
    }
  }, [visit, loadRoomEquipment]);

  const handleAddEquipmentBatch = useCallback(async (equipIds: string[], equipment: any[]) => {
    if (!visit?.id || equipIds.length === 0) return;
    setAddingEquipment(true);
    try {
      for (const eqId of equipIds) {
        const eq = equipment.find(e => e.id === eqId);
        if (!eq) continue;

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
      message.success(`Добавлено задач: ${equipIds.length}`);
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
    const photos = task.photos || [];
    const required = task.equipmentType?.photosRequired || 1;
    return `${photos.length}/${required}`;
  };

  const columns = [
    {
      title: 'Оборудование',
      dataIndex: ['equipmentType', 'name'],
      key: 'equipment',
      render: (_: any, r: any) => <span style={{ fontWeight: 500 }}>{r.equipmentType?.name}</span>,
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

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Назад</Button>
        <div className="page-title" style={{ margin: 0 }}>{isNew ? 'Новый визит' : 'Визит'}</div>
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
                form.setFieldValue('addressId', v);
              }}
              options={addressOptions.map((a: any) => ({ label: a.fullAddress, value: a.id, dataId: a.id }))}
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

      <Table
        dataSource={tasks}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
        onRow={(record) => ({
          onClick: () => {
            if (visit?.id) {
              navigate(`/visit/${visit.id}/task/${record.id}`);
            }
          },
          style: { cursor: 'pointer' },
        })}
      />

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
        onCancel={() => { setAddModalOpen(false); newTaskForm.resetFields(); setProposeEquipment(false); setSelectedRoom(null); }}
        footer={null}
        width={600}
      >
        <Tabs activeKey={addModalTab} onChange={setAddModalTab} items={[
          {
            key: 'room',
            label: '📍 Уровень помещения',
            children: roomsLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : equipmentRooms.length === 0 ? (
              <Empty description="Нет доступных помещений с оборудованием" />
            ) : (
              <>
                {!selectedRoom ? (
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
                                      {eq.brand && <span style={{ color: '#666', fontWeight: 400 }}> · {eq.brand} {eq.model || ''}</span>}
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
                <Form.Item name="brand" label="Марка">
                  <Input placeholder="Необязательно" />
                </Form.Item>
                <Form.Item name="model" label="Модель">
                  <Input placeholder="Необязательно" />
                </Form.Item>
                <Form.Item name="serialNumber" label="Серийный номер">
                  <Input placeholder="Необязательно" />
                </Form.Item>
                <Form.Item>
                  <Checkbox
                    checked={proposeEquipment}
                    onChange={(e) => setProposeEquipment(e.target.checked)}
                  >
                    Предложить добавить в привязку объекта
                  </Checkbox>
                </Form.Item>
                <Form.Item><Button type="primary" htmlType="submit" block>Добавить</Button></Form.Item>
              </Form>
            ),
          },
        ]} />
      </Modal>
    </div>
  );
}
