import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, Button, Table, Modal, Tag, Space, App, Popconfirm, DatePicker, TimePicker, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, CheckOutlined } from '@ant-design/icons';
import { api, isOffline } from '../api/client';
import { useAuthStore } from '../store/authStore';
import dayjs from 'dayjs';

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
  const [modalOpen, setModalOpen] = useState(false);
  const [equipmentTypes, setEquipmentTypes] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [addressOptions, setAddressOptions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [objectEquipment, setObjectEquipment] = useState<any[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [eqTypeMap, setEqTypeMap] = useState<Map<string, any>>(new Map());
  const [rmTypeMap, setRmTypeMap] = useState<Map<string, any>>(new Map());

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
        navigate(`/visit/${v.id}`, { replace: true });
        message.success(isOffline() ? 'Визит сохранён локально' : 'Визит создан');
      } else {
        const v = await api.updateVisit(id!, data);
        setVisit(v);
        message.success('Сохранено');
      }
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async (values: any) => {
    if (!visit?.id) { message.warning('Сначала сохраните визит'); return; }
    if (!values.roomTypeId && !values.location) {
      message.warning('Укажите тип помещения или местоположение');
      return;
    }
    if (isOffline()) {
      await api.createTaskOffline(visit.id, {
        equipmentTypeId: values.equipmentTypeId,
        roomTypeId: values.roomTypeId || '',
        location: values.location || '',
      });
    } else {
      await api.createTask(visit.id, {
        equipmentTypeId: values.equipmentTypeId,
        roomTypeId: values.roomTypeId || '',
        location: values.location || '',
      });
    }
    const v = await api.getVisit(visit.id);
    setTasks(v.tasks || []);
    setModalOpen(false);
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
      key: 'location',
      render: (_: any, r: any) => r.roomType?.name || r.location || '—',
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
        <Form form={form} layout="vertical">
          <Form.Item label="Инженер" name="engineerName" rules={[{ required: true, message: 'Введите ФИО' }]}>
            <Input placeholder="Иванов П.С." />
          </Form.Item>
          <Form.Item label="Адрес" name="addressSearch" rules={[{ required: true, message: 'Выберите адрес' }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={searchAddresses}
              placeholder="Начните вводить адрес..."
              onChange={async (v: string) => {
                form.setFieldValue('addressId', v);
                setSelectedEquipment([]);
                setObjectEquipment([]);
                if (v) {
                  try {
                    const eq = await api.getObjectEquipment(v);
                    setObjectEquipment(eq);
                    setSelectedEquipment(eq.map((e: any) => e.id));
                  } catch { /* ignore */ }
                }
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
          <Button type="primary" onClick={handleSave} loading={saving}>💾 Сохранить</Button>
          {!isNew && visit && (
            <Popconfirm title="Удалить визит?" onConfirm={handleDeleteVisit} okText="Да" cancelText="Нет">
              <Button danger>Удалить визит</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {visit && (
        <>
          {objectEquipment.length > 0 && tasks.length === 0 && (
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Оборудование объекта ({objectEquipment.length} ед.)</div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {objectEquipment.map((eq: any) => {
                  const eqType = eqTypeMap.get(eq.equipmentTypeCode);
                  const rmType = rmTypeMap.get(eq.roomTypeCode);
                  return (
                    <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <input
                        type="checkbox"
                        checked={selectedEquipment.includes(eq.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedEquipment([...selectedEquipment, eq.id]);
                          else setSelectedEquipment(selectedEquipment.filter(id => id !== eq.id));
                        }}
                      />
                      <span>{eqType?.name || eq.equipmentTypeCode}</span>
                      {eq.brand && <span style={{ color: '#666' }}>({eq.brand} {eq.model || ''})</span>}
                      {eq.serialNumber && <span style={{ color: '#999', fontSize: 12 }}>SN: {eq.serialNumber}</span>}
                      <span style={{ color: '#888', fontSize: 12 }}>{rmType?.name || eq.roomTypeCode}</span>
                    </div>
                  );
                })}
              </div>
              {selectedEquipment.length > 0 && (
                <Button type="primary" size="small" style={{ marginTop: 8 }} onClick={async () => {
                  for (const eqId of selectedEquipment) {
                    const eq = objectEquipment.find(e => e.id === eqId);
                    if (!eq) continue;
                    const eqType = eqTypeMap.get(eq.equipmentTypeCode);
                    const rmType = rmTypeMap.get(eq.roomTypeCode);
                    await api.createTask(visit.id, {
                      equipmentTypeId: eqType?.id || '',
                      roomTypeId: rmType?.id || '',
                      location: eq.locationDescription || '',
                    });
                  }
                  const v = await api.getVisit(visit.id);
                  setTasks(v.tasks || []);
                  setObjectEquipment([]);
                  setSelectedEquipment([]);
                  message.success(`Добавлено задач: ${selectedEquipment.length}`);
                }}>
                  Добавить выбранное ({selectedEquipment.length})
                </Button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Проведённые работы</div>
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Добавить оборудование</Button>
          </div>

          <Table
            dataSource={tasks}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
            onRow={(record) => ({
              onClick: () => {
                if (record.status === 'not_started') {
                  navigate(`/visit/${visit.id}/task/${record.id}`);
                } else {
                  navigate(`/visit/${visit.id}/task/${record.id}`);
                }
              },
              style: { cursor: 'pointer' },
            })}
          />

          <div style={{ marginTop: 16 }}>
            <Button type="primary" size="large" icon={<CheckOutlined />} onClick={handleComplete} disabled={tasks.filter(t => t.status === 'completed').length === 0} block>
              ✅ Завершить визит
            </Button>
          </div>
        </>
      )}

      <Modal title="Добавить оборудование" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form layout="vertical" onFinish={handleAddTask}>
          <Form.Item name="equipmentTypeId" label="Вид оборудования" rules={[{ required: true, message: 'Выберите вид оборудования' }]}>
            <Select placeholder="Выберите..." options={equipmentTypes.map(e => ({ label: e.name, value: e.id }))} />
          </Form.Item>
          <Form.Item name="roomTypeId" label="Тип помещения">
            <Select placeholder="Выберите..." allowClear options={roomTypes.map(r => ({ label: r.name, value: r.id }))} />
          </Form.Item>
          <Form.Item name="location" label="Местоположение / Назначение">
            <Input placeholder="Необязательно" />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" block>Добавить</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
