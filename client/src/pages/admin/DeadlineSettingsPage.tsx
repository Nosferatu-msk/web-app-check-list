import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, App, Typography, Space, Divider } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { api } from '@/api/client';

const { Title, Text } = Typography;

interface DeadlineForm {
  planned: {
    deadlineDays: number | null;
    notificationDaysBefore: number;
  };
  unplanned: {
    deadlineDays: number | null;
    notificationDaysBefore: number;
  };
}

export default function DeadlineSettingsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<DeadlineForm>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getDeadlineSettings();
      form.setFieldsValue({
        planned: {
          deadlineDays: data.planned?.deadlineDays ?? null,
          notificationDaysBefore: data.planned?.notificationDaysBefore ?? 5,
        },
        unplanned: {
          deadlineDays: data.unplanned?.deadlineDays ?? 14,
          notificationDaysBefore: data.unplanned?.notificationDaysBefore ?? 5,
        },
      });
    } catch {
      message.error('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await api.updateDeadlineSettings(values);
      message.success('Настройки сохранены');
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}>Настройки сроков заявок</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Настройте сроки исполнения для плановых и внеплановых заявок, а также период уведомлений о приближающемся дедлайне.
      </Text>

      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Card title="Плановая заявка" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            По умолчанию срок = календарный месяц (с 1-го по последнее число). Можно задать фиксированное количество дней.
          </Text>
          <Form.Item
            name={['planned', 'deadlineDays']}
            label="Срок исполнения (дней)"
            extra="Оставьте пустым для календарного месяца"
          >
            <InputNumber min={1} max={365} placeholder="Календарный месяц" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name={['planned', 'notificationDaysBefore']}
            label="Уведомлять за (дней)"
            rules={[{ required: true, message: 'Укажите количество дней' }]}
          >
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>
        </Card>

        <Card title="Внеплановая заявка" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            По умолчанию срок = 14 дней от даты начала.
          </Text>
          <Form.Item
            name={['unplanned', 'deadlineDays']}
            label="Срок исполнения (дней)"
            rules={[{ required: true, message: 'Укажите количество дней' }]}
          >
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name={['unplanned', 'notificationDaysBefore']}
            label="Уведомлять за (дней)"
            rules={[{ required: true, message: 'Укажите количество дней' }]}
          >
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>
        </Card>

        <Divider />

        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            Сохранить настройки
          </Button>
        </Space>
      </Form>
    </div>
  );
}
