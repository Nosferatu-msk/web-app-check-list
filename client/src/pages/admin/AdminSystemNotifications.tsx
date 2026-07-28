import { useEffect, useState } from 'react';
import { Table, Button, Space, App, Typography, Input, Form, Card, Tag, Modal } from 'antd';
import { PlusOutlined, RocketOutlined } from '@ant-design/icons';
import { api } from '../../api/client';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function AdminSystemNotifications() {
  const { message } = App.useApp();
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.getSystemReleases({ page: String(page), pageSize: '20' });
      setReleases(result.data || []);
      setTotal(result.total || 0);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const handleCreate = async (values: { title: string; message: string; version?: string }) => {
    setCreating(true);
    try {
      const result = await api.createSystemNotification(values);
      message.success(`Создано ${result.notifications_created} уведомлений`);
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (err: any) {
      message.error(err?.message || 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      title: 'Версия',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (v: string, r: any) => (
        <Space size={4}>
          <RocketOutlined style={{ color: '#52c41a' }} />
          <Tag color={r.deployedBy === 'ci_webhook' ? 'blue' : 'green'} style={{ marginRight: 0 }}>
            {v || '—'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Текст уведомления',
      dataIndex: 'releaseNotes',
      key: 'releaseNotes',
      ellipsis: true,
    },
    {
      title: 'Дата',
      dataIndex: 'deployedAt',
      key: 'deployedAt',
      width: 130,
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Получатели',
      dataIndex: 'notificationCount',
      key: 'notificationCount',
      width: 80,
      align: 'center' as const,
      render: (v: number) => <Tag style={{ marginRight: 0 }}>{v}</Tag>,
    },
    {
      title: 'Источник',
      dataIndex: 'deployedBy',
      key: 'deployedBy',
      width: 110,
      render: (v: string, r: any) => v === 'ci_webhook'
        ? <Tag color="blue" style={{ marginRight: 0 }}>CI/CD</Tag>
        : <Tag color="green" style={{ marginRight: 0 }}>Админ{r.admin?.fullName ? `: ${r.admin.fullName}` : ''}</Tag>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>Системные уведомления</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Создать уведомление
        </Button>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Системные уведомления отправляются всем активным пользователям при деплое новой версии
          или создаются вручную. Пользователи видят их в Центре уведомлений с тегом «NEW FEATURE».
        </Text>
      </Card>

      <Table
        dataSource={releases}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: 650 }}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: setPage,
          showTotal: (t) => `Всего: ${t}`,
        }}
        size="small"
      />

      <Modal
        title="Создать системное уведомление"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="version"
            label="Версия (опционально)"
            rules={[{ max: 50, message: 'Максимум 50 символов' }]}
          >
            <Input placeholder="v2.5.0" />
          </Form.Item>
          <Form.Item
            name="title"
            label="Заголовок"
            rules={[
              { required: true, message: 'Укажите заголовок' },
              { max: 255, message: 'Максимум 255 символов' },
            ]}
          >
            <Input placeholder="Вышел новый релиз" />
          </Form.Item>
          <Form.Item
            name="message"
            label="Текст уведомления"
            rules={[
              { required: true, message: 'Укажите текст' },
              { max: 2000, message: 'Максимум 2000 символов' },
            ]}
          >
            <TextArea rows={4} placeholder="Описание нового функционала..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
              <Button type="primary" htmlType="submit" loading={creating} icon={<RocketOutlined />}>
                Создать и отправить
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
