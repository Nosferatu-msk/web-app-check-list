import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Form, Select, Input, Button, Checkbox, Space, App, Spin, Card, Popconfirm } from 'antd';
import { ArrowLeftOutlined, CameraOutlined, SaveOutlined } from '@ant-design/icons';
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

const BOOL_OPTIONS = [
  { label: 'Да', value: true },
  { label: 'Нет', value: false },
];

const SATISFACTORY_OPTIONS = [
  { label: 'Удовлетворительно', value: 'satisfactory' },
  { label: 'Неудовлетворительно', value: 'unsatisfactory' },
];

// Parameter definitions per equipment type
const PARAM_CONFIG: Record<string, { key: string; label: string; type: 'select' | 'number' | 'text'; options?: any[]; required?: boolean; defaultValue?: any }[]> = {
  rsch: [
    { key: 'contact_connections', label: 'Состояние контактных соединений', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'neutral_conductor', label: 'Состояние нулевого проводника', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'grounding_circuit', label: 'Состояние заземляющего контура', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'wire_condition', label: 'Состояние проводов (оплавление, подгоревшая изоляция)', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'locking_devices', label: 'Исправность всех запирающих устройств', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'emergency_lighting', label: 'Исправность работы аварийного освещения', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'rcd_breakers', label: 'Исправность работы УЗО, автоматов диф.защиты', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
  ],
  schetchik_electroshc: [
    { key: 'model', label: 'Модель счётчика', type: 'text', required: true },
    { key: 'serial_number', label: 'Номер счётчика', type: 'text', required: true },
    { key: 'current_transformer', label: 'Трансформатор тока', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'readings', label: 'Показания', type: 'number', required: true },
  ],
  vent: [
    { key: 'unit_present', label: 'Наличие вентиляционной установки', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'Включена', value: 'on' }, { label: 'Выключена', value: 'off' }], defaultValue: 'on' },
    { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'temperature_before', label: 'Температура воздуха до теплообменника, °C', type: 'number', required: true },
    { key: 'temperature_after', label: 'Температура воздуха после теплообменника, °C', type: 'number', required: true },
  ],
  teplozavesa: [
    { key: 'unit_present', label: 'Наличие тепловой завесы', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'Включена', value: 'on' }, { label: 'Выключена', value: 'off' }], defaultValue: 'on' },
    { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'temperature_before', label: 'Температура воздуха до теплообменника, °C', type: 'number', required: true },
    { key: 'temperature_after', label: 'Температура воздуха после теплообменника, °C', type: 'number', required: true },
  ],
  pritochnaya: [
    { key: 'unit_present', label: 'Наличие приточной установки', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'Включена', value: 'on' }, { label: 'Выключена', value: 'off' }], defaultValue: 'on' },
    { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'temperature_before', label: 'Температура воздуха до теплообменника, °C', type: 'number', required: true },
    { key: 'temperature_after', label: 'Температура воздуха после теплообменника, °C', type: 'number', required: true },
  ],
  'pritochno-vytyzhnaya': [
    { key: 'unit_present', label: 'Наличие приточно-вытяжной установки', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'Включена', value: 'on' }, { label: 'Выключена', value: 'off' }], defaultValue: 'on' },
    { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'temperature_before', label: 'Температура воздуха до теплообменника, °C', type: 'number', required: true },
    { key: 'temperature_after', label: 'Температура воздуха после теплообменника, °C', type: 'number', required: true },
  ],
  vytyzhnaya: [
    { key: 'unit_present', label: 'Наличие вытяжной установки', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'Включена', value: 'on' }, { label: 'Выключена', value: 'off' }], defaultValue: 'on' },
    { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'temperature_before', label: 'Температура воздуха до теплообменника, °C', type: 'number', required: true },
    { key: 'temperature_after', label: 'Температура воздуха после теплообменника, °C', type: 'number', required: true },
  ],
  splitvn: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'room_temperature', label: 'Температура помещения на уровне 1,2м от пола, °C', type: 'number', required: true },
    { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Необходима очистка', value: 'needs_cleaning' }], defaultValue: 'needs_cleaning' },
    { key: 'drain_flush_needed', label: 'Необходимость внеплановой промывки дренажной системы', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'refrigerant_leaks', label: 'Наличие утечек хладагента', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'cooling_capacity_kw', label: 'Холодопроизводительность, кВт', type: 'number', required: true },
  ],
  splitnar: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'line_leaks', label: 'Наличие утечек на трассах', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов кондиционеров', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'unit_flush_needed', label: 'Необходимость внеплановой промывки наружного блока', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  mssvn: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'room_temperature', label: 'Температура помещения на уровне 1,2м от пола, °C', type: 'number', required: true },
    { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Необходима очистка', value: 'needs_cleaning' }], defaultValue: 'needs_cleaning' },
    { key: 'drain_flush_needed', label: 'Необходимость внеплановой промывки дренажной системы', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'refrigerant_leaks', label: 'Наличие утечек хладагента', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'cooling_capacity_kw', label: 'Холодопроизводительность, кВт', type: 'number', required: true },
  ],
  mssnar: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'line_leaks', label: 'Наличие утечек на трассах', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'unit_flush_needed', label: 'Необходимость внеплановой промывки наружного блока', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  vrv_vn: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'room_temperature', label: 'Температура помещения на уровне 1,2м от пола, °C', type: 'number', required: true },
    { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Необходима очистка', value: 'needs_cleaning' }], defaultValue: 'needs_cleaning' },
    { key: 'drain_flush_needed', label: 'Необходимость внеплановой промывки дренажной системы', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'refrigerant_leaks', label: 'Наличие утечек хладагента', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'cooling_capacity_kw', label: 'Холодопроизводительность, кВт', type: 'number', required: true },
  ],
  vrv_nar: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'line_leaks', label: 'Наличие утечек на трассах', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'unit_flush_needed', label: 'Необходимость внеплановой промывки наружного блока', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  seti_vodosnab: [
    { key: 'hvs_pipe_damage', label: 'Наличие повреждений трубопровода ХВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hws_pipe_damage', label: 'Наличие повреждений трубопровода ГВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hvs_corrosion', label: 'Наличие коррозии на трубопроводах ХВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hws_corrosion', label: 'Наличие коррозии на трубопроводах ГВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hvs_leaks', label: 'Наличие свищей/протечек на трубопроводах ХВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hws_leaks', label: 'Наличие свищей/протечек на трубопроводах ГВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'fastener_issues', label: 'Наличие неисправностей крепежей', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hvs_other_issues', label: 'Наличие прочих неисправностей трубопроводов ХВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hws_other_issues', label: 'Наличие прочих неисправностей трубопроводов ГВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'valve_tightness', label: 'Герметичность запорной, защитной и регулирующей арматуры', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'drain_condition', label: 'Сливные воронки, желоба, выпускные воронки', type: 'select', options: [{ label: 'Чистые', value: 'clean' }, { label: 'Необходима очистка', value: 'needs_cleaning' }], defaultValue: 'clean' },
  ],
  schetchik_hvs: [
    { key: 'model', label: 'Модель счётчика', type: 'text', required: true },
    { key: 'serial_number', label: 'Номер счётчика', type: 'text', required: true },
    { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'readings', label: 'Показания', type: 'number', required: true },
  ],
  schetchik_gvs: [
    { key: 'model', label: 'Модель счётчика', type: 'text', required: true },
    { key: 'serial_number', label: 'Номер счётчика', type: 'text', required: true },
    { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'readings', label: 'Показания', type: 'number', required: true },
  ],
  teplovye_seti: [
    { key: 'pipe_damage', label: 'Наличие повреждений трубопровода теплоснабжения', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'corrosion', label: 'Наличие коррозии на трубопроводах', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'leaks', label: 'Наличие свищей/протечек на трубопроводах', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'fastener_issues', label: 'Наличие неисправностей крепежей', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'other_issues', label: 'Наличие прочих неисправностей трубопроводов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'valve_tightness', label: 'Герметичность запорной, защитной и регулирующей арматуры', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'air_locks', label: 'Наличие завоздушивания системы', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'instruments_ok', label: 'Контрольно-измерительные приборы исправны', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'heating_temperature', label: 'Температуры приборов отопления, °C', type: 'number' },
  ],
};

export default function TaskPage() {
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
  const [photoCount, setPhotoCount] = useState(0);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | null>(null);
  const [formKey, setFormKey] = useState(0);
  const loadedParamsRef = useRef<Record<string, any>>({});
  const location = useLocation();

  const handleAutoSave = useCallback(async () => {
    if (!visitId || !taskId || !task) return;
    const allValues = form.getFieldsValue(true);
    const { conclusion: formConclusion, additionalRecommendations, ...formParamValues } = allValues;
    const finalConclusion = formConclusion || conclusion;
    const parameters = { ...loadedParamsRef.current, ...formParamValues, conclusion: finalConclusion };
    await api.updateTask(visitId, taskId, {
      parameters,
      selectedRecommendationIds: selectedRecs,
      additionalRecommendations: additionalRecommendations || '',
      conclusion: finalConclusion,
    });
  }, [visitId, taskId, task, form, conclusion, selectedRecs]);

  const {
    isSaving: autoSaving,
    lastSavedAt,
    markDirty: markAutoSaveDirty,
    resetDirty: resetAutoSave,
  } = useAutoSave(handleAutoSave, {
    enabled: !loading,
    isSubmitting: saving,
  });

  useEffect(() => {
    if (!visitId || !taskId) return;
    setFormInitialValues(null);
    setLoading(true);

    api.getTask(visitId, taskId).then(async t => {
      setTask(t);
      const params = (t.parameters || {}) as Record<string, any>;
      const { conclusion: c, ...rest } = params;
      const eqCode = t.equipmentType?.code || '';
      const config = PARAM_CONFIG[eqCode] || [];
      const defaults: Record<string, any> = {};
      for (const p of config) {
        if (p.defaultValue !== undefined) defaults[p.key] = p.defaultValue;
      }
      const mergedParams = { ...defaults, ...rest };
      loadedParamsRef.current = mergedParams;
      const conclusionValue = c || 'ok';
      setConclusion(conclusionValue);
      setSelectedRecs(t.selectedRecommendationIds || []);
      if (t.equipmentType) {
        const recs = await api.getRecommendations(t.equipmentType.id);
        setRecommendations(recs);
      }
      const photos = await api.getPhotos(taskId);
      setPhotoCount(photos.length);

      const initVals = {
        ...mergedParams,
        conclusion: conclusionValue,
        additionalRecommendations: t.additionalRecommendations || '',
      };

      setFormKey(k => k + 1);
      setFormInitialValues(initVals);
      setLoading(false);
    });
  }, [visitId, taskId, location.key]);

  // Set form values after form renders with new key
  useEffect(() => {
    if (!loading && formInitialValues && Object.keys(formInitialValues).length > 0) {
      const fields = Object.entries(formInitialValues).map(([name, value]) => ({
        name,
        value,
        touched: true,
      }));
      const timer = setTimeout(() => {
        form.setFields(fields);
        resetAutoSave();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [formKey]);

  const handleSave = async () => {
    if (!visitId || !taskId || !task) return;
    try {
      await form.validateFields();
      setSaving(true);

      const allValues = form.getFieldsValue(true);
      const { conclusion: formConclusion, additionalRecommendations, ...formParamValues } = allValues;
      const finalConclusion = formConclusion || conclusion;
      const parameters = { ...loadedParamsRef.current, ...formParamValues, conclusion: finalConclusion };

      const photosRequired = task.equipmentType?.photosRequired || 1;
      const hasAllPhotos = photoCount >= photosRequired;
      const status = hasAllPhotos ? 'completed' : 'in_progress';

      await api.updateTask(visitId, taskId, {
        parameters,
        selectedRecommendationIds: selectedRecs,
        additionalRecommendations: additionalRecommendations || '',
        conclusion: finalConclusion,
        status,
      });
      message.success(hasAllPhotos ? 'Сохранено' : 'Параметры сохранены. Загрузите фотографии для завершения');
      navigate(`/visit/${visitId}`);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGoToPhotos = async () => {
    // Save parameters before going to photos
    if (!visitId || !taskId || !task) {
      navigate(`/visit/${visitId}/task/${taskId}/photos`);
      return;
    }
    try {
      const allValues = form.getFieldsValue(true);
      const { conclusion: formConclusion, additionalRecommendations, ...formParamValues } = allValues;
      const finalConclusion = formConclusion || conclusion;
      const parameters = { ...loadedParamsRef.current, ...formParamValues, conclusion: finalConclusion };

      await api.updateTask(visitId, taskId, {
        parameters,
        selectedRecommendationIds: selectedRecs,
        additionalRecommendations: additionalRecommendations || '',
        conclusion: finalConclusion,
      });
    } catch {
      // Silent save - don't block navigation
    }
    navigate(`/visit/${visitId}/task/${taskId}/photos`);
  };

  const handleReset = async () => {
    if (!visitId || !taskId) return;
    await api.resetTask(visitId, taskId);
    message.success('Задача сброшена');
    navigate(`/visit/${visitId}`);
  };

  const equipmentCode = task?.equipmentType?.code || '';
  const paramConfig = PARAM_CONFIG[equipmentCode] || [];

  if (loading || formInitialValues === null) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/visit/${visitId}`)}>Назад</Button>
        <div className="page-title" style={{ margin: 0 }}>{task?.equipmentType?.name}</div>
      </div>

      <Card>
        <Form form={form} key={formKey} initialValues={formInitialValues} layout="vertical" onValuesChange={markAutoSaveDirty}>
          {paramConfig.map(p => (
            <Form.Item key={p.key} label={p.label} name={p.key} rules={p.required ? [{ required: true, message: 'Заполните поле' }] : []}>
              {p.type === 'select' ? (
                <Select options={p.options} placeholder="Выберите..." />
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
            <Form.Item label="Типовые рекомендации">
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
              const isRequired = currentConclusion === 'ok_with_notes' || currentConclusion === 'faulty';
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

        <Space style={{ width: '100%' }} direction="vertical" size="middle">
          <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />} block size="large">
            Сохранить и вернуться в чек-лист
          </Button>
          {(autoSaving || lastSavedAt) && (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#999' }}>
              {autoSaving ? 'Автосохранение...' : `Сохранено ${dayjs(lastSavedAt).fromNow()}`}
            </div>
          )}
          <Space>
            <Button onClick={() => navigate(`/visit/${visitId}`)}>Назад</Button>
            <Button icon={<CameraOutlined />} onClick={handleGoToPhotos}>Фото</Button>
            <Popconfirm title="Сбросить задачу? Все данные будут удалены." onConfirm={handleReset} okText="Да" cancelText="Нет">
              <Button danger>Сбросить задачу</Button>
            </Popconfirm>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
