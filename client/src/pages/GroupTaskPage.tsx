import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Select, Input, Button, Checkbox, Space, App, Spin, Card, Popconfirm, Collapse, Tag, Modal, List, Empty } from 'antd';
import { ArrowLeftOutlined, CameraOutlined, SaveOutlined, DeleteOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useAutoSave } from '../hooks/useAutoSave';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const { TextArea } = Input;

const CONCLUSION_OPTIONS = [
  { label: 'Исправно, замечаний нет', value: 'ok' },
  { label: 'Исправно, есть замечания', value: 'ok_with_notes' },
  { label: 'Неисправно', value: 'faulty' },
];

// Параметры для групповой задачи климата (внутренние блоки)
const GROUP_CLIMATE_PARAMS = [
  { key: 'room_temperature', label: 'Температура помещения на уровне 1,2м от пола, °C', type: 'number' as const, required: true },
];

// Параметры для групповой задачи наружных блоков
const GROUP_OUTDOOR_PARAMS = [
  { key: 'operability', label: 'Работоспособность', type: 'select' as const, options: [{ label: 'Удовлетворительно', value: 'satisfactory' }, { label: 'Неудовлетворительно', value: 'unsatisfactory' }], required: true },
  { key: 'line_leaks', label: 'Наличие утечек на трассах', type: 'select' as const, options: [{ label: 'Да', value: true }, { label: 'Нет', value: false }] },
  { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select' as const, options: [{ label: 'Да', value: true }, { label: 'Нет', value: false }] },
];

interface EquipmentItem {
  id: string;
  taskId: string;
  objectEquipmentId: string;
  status?: 'ok' | 'not_ok';
  sortOrder: number;
  objectEquipment?: {
    id: string;
    equipmentTypeCode: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    roomTypeCode?: string;
    isOutdoorUnit: boolean;
  };
  photos: { id: string; moment: string }[];
}

export default function GroupTaskPage() {
  const { message } = App.useApp();
  const { visitId, taskId } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedRecs, setSelectedRecs] = useState<string[]>([]);
  const [conclusion, setConclusion] = useState<string>('ok');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [availableEquipment, setAvailableEquipment] = useState<any[]>([]);
  const [selectedEquipIds, setSelectedEquipIds] = useState<string[]>([]);
  const [equipLoading, setEquipLoading] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | null>(null);
  const [formKey, setFormKey] = useState(0);

  const isOutdoor = task?.taskType === 'group_climate' && items.length > 0 && items[0].objectEquipment?.isOutdoorUnit;
  const paramConfig = isOutdoor ? GROUP_OUTDOOR_PARAMS : GROUP_CLIMATE_PARAMS;

  const loadTask = useCallback(async () => {
    if (!visitId || !taskId) return;
    const t = await api.getTask(visitId, taskId);
    setTask(t);
    setItems(t.equipmentItems || []);
    const params = (t.parameters || {}) as Record<string, any>;
    const { conclusion: c, ...rest } = params;
    const conclusionValue = c || 'ok';
    setConclusion(conclusionValue);
    setSelectedRecs(t.selectedRecommendationIds || []);
    if (t.equipmentType) {
      const recs = await api.getRecommendations(t.equipmentType.id);
      setRecommendations(recs);
    }
    const initVals = { ...rest, conclusion: conclusionValue, additionalRecommendations: t.additionalRecommendations || '' };
    setFormInitialValues(initVals);
    setFormKey(k => k + 1);
    setLoading(false);
  }, [visitId, taskId]);

  useEffect(() => { loadTask(); }, [loadTask]);

  useEffect(() => {
    if (!loading && formInitialValues && Object.keys(formInitialValues).length > 0) {
      const fields = Object.entries(formInitialValues).map(([name, value]) => ({ name, value, touched: true }));
      const timer = setTimeout(() => { form.setFields(fields); }, 100);
      return () => clearTimeout(timer);
    }
  }, [formKey]);

  const handleAutoSave = useCallback(async () => {
    if (!visitId || !taskId || !task) return;
    const allValues = form.getFieldsValue(true);
    const { conclusion: formConclusion, additionalRecommendations, ...formParamValues } = allValues;
    const finalConclusion = formConclusion || conclusion;
    const parameters = { ...formParamValues, conclusion: finalConclusion };
    await api.updateTask(visitId, taskId, {
      parameters,
      selectedRecommendationIds: selectedRecs,
      additionalRecommendations: additionalRecommendations || '',
      conclusion: finalConclusion,
    });
  }, [visitId, taskId, task, form, conclusion, selectedRecs]);

  const { isSaving: autoSaving, lastSavedAt, markDirty: markAutoSaveDirty, resetDirty: resetAutoSave } = useAutoSave(handleAutoSave, {
    enabled: !loading,
    isSubmitting: saving,
  });

  const handleSave = async () => {
    if (!visitId || !taskId || !task) return;
    try {
      await form.validateFields();

      // Проверка: все единицы должны иметь статус
      const itemsWithoutStatus = items.filter(i => !i.status);
      if (itemsWithoutStatus.length > 0) {
        message.warning('Укажите статус для всех единиц оборудования');
        return;
      }

      // Проверка: все единицы должны иметь фото
      const itemsWithoutPhotos = items.filter(i => i.photos.length < 2);
      if (itemsWithoutPhotos.length > 0) {
        message.warning('Загрузите фото ДО и ПОСЛЕ для всех единиц оборудования');
        return;
      }

      // Проверка: если есть "Не ОК" — рекомендации обязательны
      const hasNotOk = items.some(i => i.status === 'not_ok');
      const additionalRecs = form.getFieldValue('additionalRecommendations');
      if (hasNotOk && selectedRecs.length === 0 && !additionalRecs) {
        message.warning('При наличии неисправных единиц укажите рекомендации');
        return;
      }

      setSaving(true);
      const allValues = form.getFieldsValue(true);
      const { conclusion: formConclusion, additionalRecommendations, ...formParamValues } = allValues;
      const finalConclusion = formConclusion || conclusion;
      const parameters = { ...formParamValues, conclusion: finalConclusion };

      await api.updateTask(visitId, taskId, {
        parameters,
        selectedRecommendationIds: selectedRecs,
        additionalRecommendations: additionalRecommendations || '',
        conclusion: finalConclusion,
        status: 'completed',
      });
      message.success('Сохранено');
      navigate(`/visit/${visitId}`);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!visitId || !taskId) return;
    await api.resetTask(visitId, taskId);
    message.success('Задача сброшена');
    await loadTask();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!visitId || !taskId) return;
    await api.deleteTaskItem(visitId, taskId, itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
    message.success('Единица удалена');
  };

  const handleItemStatusChange = async (itemId: string, status: 'ok' | 'not_ok') => {
    if (!visitId || !taskId) return;
    await api.updateTaskItem(visitId, taskId, itemId, { status });
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status } : i));
  };

  const handleOpenAddModal = async () => {
    if (!task) return;
    setAddModalOpen(true);
    setEquipLoading(true);
    try {
      const addressId = task.visit?.addressId;
      if (!addressId) {
        // Загрузим визит для получения addressId
        const v = await api.getVisit(visitId!);
        const eq = await api.getObjectEquipment(v.addressId, {
          exclude_visit_id: visitId,
          is_outdoor_unit: isOutdoor ? 'true' : 'false',
          ...(isOutdoor ? {} : { room_type_code: task.roomTypeCode }),
        });
        setAvailableEquipment(eq);
      } else {
        const eq = await api.getObjectEquipment(addressId, {
          exclude_visit_id: visitId,
          is_outdoor_unit: isOutdoor ? 'true' : 'false',
          ...(isOutdoor ? {} : { room_type_code: task.roomTypeCode }),
        });
        setAvailableEquipment(eq);
      }
    } catch { /* ignore */ }
    setEquipLoading(false);
    setSelectedEquipIds([]);
  };

  const handleAddItems = async () => {
    if (!visitId || !taskId || selectedEquipIds.length === 0) return;
    setAddingItem(true);
    try {
      for (const eqId of selectedEquipIds) {
        await api.addTaskItem(visitId, taskId, eqId);
      }
      await loadTask();
      setAddModalOpen(false);
      message.success(`Добавлено единиц: ${selectedEquipIds.length}`);
    } catch (err: any) {
      message.error(err.message);
    }
    setAddingItem(false);
  };

  const handleGoToItemPhotos = (itemId: string) => {
    navigate(`/visit/${visitId}/task/${taskId}/item/${itemId}/photos`);
  };

  const getItemPhotoProgress = (item: EquipmentItem) => {
    return `${item.photos.length}/2`;
  };

  const getItemTypeName = (code: string) => {
    const names: Record<string, string> = {
      splitvn: 'Внутр. блок СС',
      mssvn: 'Внутр. блок МСС',
      vrv_vn: 'Внутр. блок VRV',
      splitnar: 'Наружн. блок СС',
      mssnar: 'Наружн. блок МСС',
      vrv_nar: 'Наружн. блок VRV',
    };
    return names[code] || code;
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/visit/${visitId}`)}>Назад</Button>
        <div className="page-title" style={{ margin: 0 }}>
          {isOutdoor ? '🏠 Наружные блоки кондиционеров' : '🌡 Климатическое оборудование'}
        </div>
      </div>

      {/* Общие параметры */}
      <Card title="Общие параметры" style={{ marginBottom: 16 }}>
        <Form form={form} key={formKey} initialValues={formInitialValues || undefined} layout="vertical" onValuesChange={markAutoSaveDirty}>
          {paramConfig.map(p => (
            <Form.Item key={p.key} label={p.label} name={p.key} rules={p.required ? [{ required: true, message: 'Заполните поле' }] : []}>
              {p.type === 'select' ? (
                <Select options={p.options as any} placeholder="Выберите..." />
              ) : p.type === 'number' ? (
                <Input type="number" placeholder="Введите значение" />
              ) : (
                <Input placeholder="Введите значение" />
              )}
            </Form.Item>
          ))}

          <Form.Item label="Заключение" name="conclusion" rules={[{ required: true }]}>
            <Select options={CONCLUSION_OPTIONS} onChange={(v) => setConclusion(v)} />
          </Form.Item>

          {recommendations.length > 0 && (
            <Form.Item label="Рекомендации">
              <Checkbox.Group value={selectedRecs} onChange={(v) => { setSelectedRecs(v as string[]); markAutoSaveDirty(); }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recommendations.map(r => (
                    <Checkbox key={r.id} value={r.id}>{r.text}</Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          )}

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.conclusion !== cur.conclusion}>
            {({ getFieldValue }) => {
              const currentConclusion = getFieldValue('conclusion');
              const hasNotOk = items.some(i => i.status === 'not_ok');
              const isRequired = currentConclusion === 'ok_with_notes' || currentConclusion === 'faulty' || hasNotOk;
              return (
                <Form.Item
                  label="Дополнительные рекомендации"
                  name="additionalRecommendations"
                  rules={isRequired ? [{ required: true, message: 'Обязательно при замечаниях' }] : []}
                >
                  <TextArea rows={3} placeholder="Опишите проблему или рекомендации..." />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Card>

      {/* Единицы оборудования */}
      <Card
        title={`Единицы оборудования (${items.length})`}
        extra={
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleOpenAddModal}>
            Добавить единицу
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        {items.length === 0 ? (
          <Empty description="Нет единиц оборудования. Добавьте хотя бы одну." />
        ) : (
          <Collapse
            accordion
            items={items.map((item, idx) => {
              const eq = item.objectEquipment;
              const photosBefore = item.photos.filter(p => p.moment === 'before').length;
              const photosAfter = item.photos.filter(p => p.moment === 'after').length;
              const photosComplete = photosBefore >= 1 && photosAfter >= 1;

              return {
                key: item.id,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <span style={{ fontWeight: 500 }}>
                      {idx + 1}. {getItemTypeName(eq?.equipmentTypeCode || '')}
                    </span>
                    <span style={{ color: '#666', fontSize: 12 }}>
                      {eq?.brand} {eq?.model} {eq?.serialNumber && `· SN:${eq.serialNumber}`}
                    </span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      {item.status === 'ok' && <Tag color="success" icon={<CheckCircleOutlined />}>Исправно</Tag>}
                      {item.status === 'not_ok' && <Tag color="error" icon={<CloseCircleOutlined />}>Неисправно</Tag>}
                      {!item.status && <Tag color="default">Без статуса</Tag>}
                      <Tag color={photosComplete ? 'success' : 'warning'}>📷 {getItemPhotoProgress(item)}</Tag>
                    </span>
                  </div>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>Статус:</div>
                      <Space>
                        <Button
                          type={item.status === 'ok' ? 'primary' : 'default'}
                          onClick={() => handleItemStatusChange(item.id, 'ok')}
                          style={item.status === 'ok' ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
                        >
                          ✅ Исправно
                        </Button>
                        <Button
                          type={item.status === 'not_ok' ? 'primary' : 'default'}
                          danger={item.status === 'not_ok'}
                          onClick={() => handleItemStatusChange(item.id, 'not_ok')}
                        >
                          ⚠️ Неисправно
                        </Button>
                      </Space>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>Фотофиксация:</div>
                      <Space>
                        <Button icon={<CameraOutlined />} onClick={() => handleGoToItemPhotos(item.id)}>
                          Фото ({getItemPhotoProgress(item)})
                        </Button>
                      </Space>
                    </div>
                    <Popconfirm
                      title="Удалить единицу из задачи?"
                      onConfirm={() => handleDeleteItem(item.id)}
                      okText="Да"
                      cancelText="Нет"
                    >
                      <Button danger icon={<DeleteOutlined />} size="small">
                        Удалить единицу
                      </Button>
                    </Popconfirm>
                  </div>
                ),
              };
            })}
          />
        )}
      </Card>

      {/* Кнопки управления */}
      <Space style={{ width: '100%' }} direction="vertical" size="middle">
        <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />} block size="large">
          💾 Сохранить и вернуться в чек-лист
        </Button>
        {(autoSaving || lastSavedAt) && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#999' }}>
            {autoSaving ? 'Автосохранение...' : `Сохранено ${dayjs(lastSavedAt).fromNow()}`}
          </div>
        )}
        <Space>
          <Button onClick={() => navigate(`/visit/${visitId}`)}>← Назад</Button>
          <Popconfirm title="Сбросить задачу? Все данные будут удалены." onConfirm={handleReset} okText="Да" cancelText="Нет">
            <Button danger>🗑 Сбросить задачу</Button>
          </Popconfirm>
        </Space>
      </Space>

      {/* Модальное окно добавления единиц */}
      <Modal
        title="Добавить единицу оборудования"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={null}
        width={500}
      >
        {equipLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : availableEquipment.length === 0 ? (
          <Empty description="Нет доступного оборудования для добавления" />
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>
              <Checkbox
                checked={selectedEquipIds.length === availableEquipment.length}
                onChange={(e) => setSelectedEquipIds(e.target.checked ? availableEquipment.map((eq: any) => eq.id) : [])}
              >
                Выбрать все ({availableEquipment.length})
              </Checkbox>
            </div>
            <List
              dataSource={availableEquipment}
              renderItem={(eq: any) => {
                const checked = selectedEquipIds.includes(eq.id);
                return (
                  <List.Item
                    style={{ cursor: 'pointer', padding: '8px 4px' }}
                    onClick={() => {
                      if (checked) setSelectedEquipIds(selectedEquipIds.filter(id => id !== eq.id));
                      else setSelectedEquipIds([...selectedEquipIds, eq.id]);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <Checkbox checked={checked} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>
                          {getItemTypeName(eq.equipmentTypeCode)}
                          {eq.brand && <span style={{ color: '#666', fontWeight: 400 }}> · {eq.brand} {eq.model || ''}</span>}
                        </div>
                        {eq.serialNumber && <div style={{ fontSize: 12, color: '#888' }}>SN: {eq.serialNumber}</div>}
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
              disabled={selectedEquipIds.length === 0}
              loading={addingItem}
              onClick={handleAddItems}
            >
              Добавить {selectedEquipIds.length > 0 ? `(${selectedEquipIds.length})` : ''}
            </Button>
          </>
        )}
      </Modal>
    </div>
  );
}
