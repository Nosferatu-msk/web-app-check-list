import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Space, Tag, App, Typography, Popconfirm,
} from 'antd';
import { PlusOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { api } from '@/api/client';
import type { Contract } from '@shared/types';

const { Title } = Typography;

export default function ContractsPage() {
  const { message } = App.useApp();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tmList, setTmList] = useState<{ id: string; fullName: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [form] = Form.useForm();
  const [moduleFilter, setModuleFilter] = useState<string>('to');

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await api.getContracts({ module: moduleFilter });
      setContracts(data);
    } catch {
      message.error('Ошибка загрузки договоров');
    } finally {
      setLoading(false);
    }
  };

  const fetchTmList = async () => {
    try {
      const role = moduleFilter === 'mtr' ? 'tm_mtr' : 'tm';
      const res = await api.adminGet('users', { page: '1', pageSize: '200', role });
      setTmList((res.data || []).filter((u: any) => u.isActive !== false));
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchContracts();
    fetchTmList();
  }, [moduleFilter]);

  const handleCreate = () => {
    setEditingContract(null);
    form.resetFields();
    form.setFieldsValue({ module: moduleFilter });
    setModalOpen(true);
  };

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract);
    form.setFieldsValue({ number: contract.number });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingContract) {
        await api.updateContract(editingContract.id, { number: values.number });
        message.success('Договор обновлён');
      } else {
        await api.createContract({
          number: values.number,
          tmId: values.tmId,
          module: values.module || moduleFilter,
        });
        message.success('Договор создан');
      }
      setModalOpen(false);
      fetchContracts();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || 'Ошибка сохранения');
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await api.deactivateContract(id);
      message.success('Договор деактивирован');
      fetchContracts();
    } catch {
      message.error('Ошибка деактивации');
    }
  };

  const columns = [
    {
      title: 'Номер договора',
      dataIndex: 'number',
      key: 'number',
      render: (number: string) => (
        <Tag color="purple" style={{ fontFamily: 'monospace' }}>{number}</Tag>
      ),
    },
    {
      title: 'ТМ',
      key: 'tm',
      render: (_: any, record: Contract) => record.tm?.fullName || '—',
    },
    {
      title: 'Модуль',
      dataIndex: 'module',
      key: 'module',
      render: (module: string) => (
        <Tag color={module === 'to' ? 'blue' : 'green'}>
          {module === 'to' ? 'ТО' : 'МТР'}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        isActive
          ? <Tag color="success" icon={<CheckCircleOutlined />}>Активен</Tag>
          : <Tag color="default" icon={<StopOutlined />}>Неактивен</Tag>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: any, record: Contract) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            Изменить
          </Button>
          {record.isActive && (
            <Popconfirm
              title="Деактивировать договор?"
              description="Договор будет скрыт из списков выбора"
              onConfirm={() => handleDeactivate(record.id)}
            >
              <Button type="link" danger size="small">
                Деактивировать
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Договоры</Title>
        <Space>
          <Select
            value={moduleFilter}
            onChange={setModuleFilter}
            style={{ width: 120 }}
            options={[
              { value: 'to', label: 'ТО' },
              { value: 'mtr', label: 'МТР' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Создать договор
          </Button>
        </Space>
      </div>

      <Table
        dataSource={contracts}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingContract ? 'Редактировать договор' : 'Новый договор'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingContract ? 'Сохранить' : 'Создать'}
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="number"
            label="Номер договора"
            rules={[
              { required: true, message: 'Укажите номер договора' },
              { len: 12, message: 'Номер должен содержать ровно 12 символов' },
              { pattern: /^05000/, message: 'Номер должен начинаться с 05000' },
            ]}
            extra="Ровно 12 символов, начинается с 05000. Пример: 050005596590"
          >
            <Input placeholder="050005596590" maxLength={12} />
          </Form.Item>
          {!editingContract && (
            <>
              <Form.Item
                name="tmId"
                label="Территориальный менеджер"
                rules={[{ required: true, message: 'Выберите ТМ' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Выберите ТМ"
                  options={tmList.map(tm => ({ value: tm.id, label: tm.fullName }))}
                />
              </Form.Item>
              <Form.Item name="module" label="Модуль" initialValue={moduleFilter}>
                <Select
                  options={[
                    { value: 'to', label: 'ТО' },
                    { value: 'mtr', label: 'МТР' },
                  ]}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
