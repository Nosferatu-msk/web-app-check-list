import { useState, useEffect } from 'react';
import { Form, Input, AutoComplete, Collapse, Tag, Tooltip, Button, App, Space, Card } from 'antd';
import { EditOutlined, CheckOutlined, CloseOutlined, FileTextOutlined } from '@ant-design/icons';
import { api } from '../api/client';

interface EquipmentInfoFormProps {
  task: any;
  onValuesChange?: (changedValues: any) => void;
}

// Валидация: текст не начинается со спецсимвола или пробела
const validateNoSpecialStart = (_: any, value: string) => {
  if (!value) return Promise.resolve();
  const trimmed = value.trim();
  if (trimmed.length === 0) return Promise.resolve();
  if (!/^[\p{L}\p{N}]/u.test(trimmed)) {
    return Promise.reject(new Error('Не может начинаться со спецсимвола или пробела'));
  }
  return Promise.resolve();
};

export default function EquipmentInfoForm({ task, onValuesChange }: EquipmentInfoFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [isEditing, setIsEditing] = useState(false);
  const [originalValues, setOriginalValues] = useState<any>({});
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string; manufacturerId?: string }[]>([]);
  const [brandOptions, setBrandOptions] = useState<{ value: string; label: string; id?: string }[]>([]);
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string | null>(null);
  const [autoFilledFromObjectEquipment, setAutoFilledFromObjectEquipment] = useState(false);

  const equipmentCode = task?.equipmentType?.code || '';
  const isMeter = ['schetchik_electroshc', 'schetchik_hvs', 'schetchik_gvs', 'meter_gas'].includes(equipmentCode);

  // Загрузка данных из ObjectEquipment при монтировании
  useEffect(() => {
    // Приоритет: task (данные инженера) > objectEquipment (данные из справочника)
    // Если инженер указал brand/model/serialNumber в задаче — используем их
    // Если нет — берём из ObjectEquipment
    const eq = task?.objectEquipment;
    const values = {
      brand: task?.brand || eq?.brand || '',
      model: task?.model || eq?.model || '',
      serialNumber: task?.serialNumber || eq?.serialNumber || '',
    };
    form.setFieldsValue(values);
    setOriginalValues(values);
    // Отслеживаем, были ли данные заполнены из ObjectEquipment (а не из задачи)
    setAutoFilledFromObjectEquipment(!task?.brand && !task?.model && !task?.serialNumber && !!eq && (eq.brand || eq.model || eq.serialNumber));
    
    // Если есть brand, пытаемся найти manufacturerId
    if (values.brand) {
      api.getManufacturersList().then(results => {
        const manufacturer = results.find((m: any) => m.name === values.brand);
        if (manufacturer) {
          setSelectedManufacturerId(manufacturer.id);
        }
      }).catch(() => {
        // Silent error
      });
    }
  }, [task, form]);

  const handleModelSearch = async (query: string) => {
    if (!task?.equipmentType?.id) return;
    try {
      // Передаём manufacturerId для фильтрации моделей по выбранному производителю
      const params: any = { equipment_type_id: task.equipmentType.id, query };
      if (selectedManufacturerId) {
        params.manufacturer_id = selectedManufacturerId;
      }
      const results = await api.searchModels(params);
      setModelOptions(results.map((m: any) => ({
        value: m.modelName,
        label: m.modelName,
        manufacturerId: m.manufacturerId,
      })));
    } catch {
      setModelOptions([]);
    }
  };

  const handleBrandSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setBrandOptions([]);
      return;
    }
    try {
      // Используем публичный эндпоинт /refs/manufacturers вместо /admin/manufacturers
      const results = await api.getManufacturersList();
      const queryLower = query.toLowerCase();
      const filtered = results.filter((m: any) => {
        const name = String(m.name || '').toLowerCase();
        return name.includes(queryLower);
      }).slice(0, 20);
      setBrandOptions(filtered.map((m: any) => ({
        value: m.name,
        label: m.name,
        id: m.id,
      })));
    } catch {
      setBrandOptions([]);
    }
  };

  // Обработчик выбора марки (изготовителя)
  const handleBrandSelect = (value: string, option: any) => {
    // Сохраняем manufacturerId для фильтрации моделей
    // option.id содержит id производителя из brandOptions
    setSelectedManufacturerId(option.id || null);
    // Очищаем модель, если она была выбрана ранее
    form.setFieldsValue({ model: '' });
    setModelOptions([]);
  };

  // Обработчик выбора модели
  const handleModelSelect = (value: string, option: any) => {
    // Сценарий 2: если выбрана модель, автоматически устанавливаем марку
    if (option.manufacturerId) {
      // Ищем производителя по ID
      api.getManufacturersList().then(results => {
        const manufacturer = results.find((m: any) => m.id === option.manufacturerId);
        if (manufacturer) {
          form.setFieldsValue({ brand: manufacturer.name });
          setSelectedManufacturerId(manufacturer.id);
        }
      }).catch(() => {
        // Silent error
      });
    }
  };

  const hasChanges = () => {
    const values = form.getFieldsValue();
    return (
      values.brand !== originalValues.brand ||
      values.model !== originalValues.model ||
      values.serialNumber !== originalValues.serialNumber
    );
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    form.setFieldsValue(originalValues);
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      const values = form.getFieldsValue();
      
      // Валидация
      if (values.brand) {
        await validateNoSpecialStart(null, values.brand);
      }
      if (values.model) {
        await validateNoSpecialStart(null, values.model);
      }
      if (values.serialNumber) {
        await validateNoSpecialStart(null, values.serialNumber);
      }

      const hasChangesFlag = hasChanges();

      // Создаём proposal на изменение данных оборудования
      if (task?.objectEquipmentId && hasChangesFlag) {
        await api.createProposal({
          addressId: task.visit?.addressId || task.visit?.address_id,
          equipmentTypeCode: equipmentCode,
          brand: values.brand,
          model: values.model,
          serialNumber: values.serialNumber,
          taskId: task.id,
          objectEquipmentId: task.objectEquipmentId,
          requestType: 'brand_change',
        });
        message.info('Изменения отправлены на модерацию');
      }

      // Обновляем задачу
      await api.updateTask(task.visitId, task.id, {
        brand: values.brand,
        model: values.model,
        serialNumber: values.serialNumber,
      });

      setOriginalValues(values);
      setIsEditing(false);
      if (!hasChangesFlag) {
        message.success('Данные задачи обновлены');
      }
    } catch (err: any) {
      message.error(err.message || 'Ошибка сохранения');
    }
  };

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Оборудование</span>
          {isMeter && <Tag color="blue">Прибор учёта</Tag>}
          {!isEditing && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={handleEdit}
            />
          )}
          {isEditing && (
            <>
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                onClick={handleSave}
                disabled={!hasChanges()}
                style={{ color: '#52c41a' }}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancel}
                style={{ color: '#ff4d4f' }}
              />
            </>
          )}
        </div>
      }
      style={{ marginBottom: 16 }}
    >
      <Form form={form} layout="vertical" disabled={!isEditing} onValuesChange={onValuesChange}>
        <Form.Item
          label="Марка (изготовитель)"
          name="brand"
          rules={[{ validator: validateNoSpecialStart }]}
          style={{ marginBottom: 12 }}
        >
          <AutoComplete
            options={brandOptions}
            onSearch={handleBrandSearch}
            onSelect={handleBrandSelect}
            placeholder="Начните вводить для поиска или введите вручную..."
            filterOption={false}
            allowClear
          />
        </Form.Item>

        <Form.Item
          label="Модель"
          name="model"
          rules={[{ validator: validateNoSpecialStart }]}
          style={{ marginBottom: 12 }}
        >
          <AutoComplete
            options={modelOptions}
            onSearch={handleModelSearch}
            onSelect={handleModelSelect}
            placeholder={selectedManufacturerId ? "Начните вводить модель..." : "Сначала выберите марку или введите модель вручную..."}
            filterOption={false}
            allowClear
          />
        </Form.Item>

        <Form.Item
          label={
            <span>
              Серийный номер
              {isMeter && <Tag color="red" style={{ marginLeft: 8 }}>Обязательно</Tag>}
            </span>
          }
          name="serialNumber"
          rules={[
            { validator: validateNoSpecialStart },
            ...(isMeter ? [{ required: true, message: 'Обязательно для приборов учёта' }] : []),
          ]}
          style={{ marginBottom: 0 }}
        >
          <Input placeholder="Введите серийный номер" />
        </Form.Item>
      </Form>
    </Card>
  );
}
