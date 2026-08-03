import { useEffect, useState, useCallback } from 'react';
import { Button, Table, Space, Input, App, Modal, Form, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { api } from '../../api/client';
import { MtrWorkType } from '../../../../shared/types/index';
import { useIsMobile } from '../../hooks/useIsMobile';

export default function MtrAdminWorkTypes() {
  const [workTypes, setWorkTypes] = useState<MtrWorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorkType, setEditingWorkType] = useState<MtrWorkType | null>(null);
  const [form] = Form.useForm();
  const pageSize = 10;
  const { message, modal } = App.useApp();
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: currentPage, pageSize };
      if (searchQuery) params.search = searchQuery;
      const res = await api.mtr.getWorkTypes(params);
      setWorkTypes(res.data || []);
      setTotal(res.total || 0);
    } catch {
      message.error('Ошибка загрузки');
    }
    setLoading(false);
  }, [currentPage, searchQuery, message]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleCreate = () => {
    setEditingWorkType(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (record: MtrWorkType) => {
    setEditingWorkType(record);
    form.setFieldsValue({
      name: record.name,
      category: record.category || '',
      isActive: record.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingWorkType) {
        await api.mtr.updateWorkType(editingWorkType.id, values);
        message.success('Вид работы обновлён');
      } else {
        await api.mtr.createWorkType(values);
        message.success('Вид работы создан');
      }
      setModalOpen(false);
      form.resetFields();
      await load();
    } catch (err: any) {
      if (err.errorFields) return; // form validation error
      message.error(err.message);
    }
  };

  const handleDelete = (record: MtrWorkType) => {
    modal.confirm({
      title: 'Удалить вид работы?',
      content: record.name,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.mtr.deleteWorkType(record.id);
          message.success('Вид работы удалён');
          await load();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Категория',
      dataIndex: 'category',
      key: 'category',
      width: 200,
      render: (cat: string) => cat || '—',
    },
    {
      title: 'Активен',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active: boolean) => active ? '✅' : '❌',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_: any, record: MtrWorkType) => (
        <Space>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Виды работ МТР</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>Добавить</Button>
      </div>

      <div style={{ marginBottom: 16, maxWidth: 400 }}>
        <Input
          placeholder="Поиск по названию..."
          prefix={<SearchOutlined />}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          allowClear
        />
      </div>

      <Table
        dataSource={workTypes}
        columns={isMobile ? columns.filter(c => c.key !== 'category') : columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize,
          total,
          onChange: (page) => setCurrentPage(page),
          showSizeChanger: true,
          pageSizeOptions: [10, 25, 50],
          showTotal: (total) => `Всего: ${total}`,
        }}
      />

      <Modal
        title={editingWorkType ? 'Редактировать вид работы' : 'Новый вид работы'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={handleSave}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Укажите название' }]}>
            <Input placeholder="Название вида работы" />
          </Form.Item>
          <Form.Item name="category" label="Категория">
            <Input placeholder="Категория (необязательно)" />
          </Form.Item>
          <Form.Item name="isActive" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
