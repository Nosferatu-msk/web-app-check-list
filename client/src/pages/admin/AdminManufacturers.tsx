import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Space, App, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import { api } from '../../api/client';

export default function AdminManufacturers() {
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.getManufacturers({ page, pageSize, q: search || undefined });
    setData(res.data);
    setTotal(res.total);
    setLoading(false);
  }, [page, pageSize, search]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editing) {
      await api.updateManufacturer(editing.id, values);
      message.success('Производитель обновлён');
    } else {
      await api.createManufacturer(values);
      message.success('Производитель добавлен');
    }
    setModalOpen(false);
    form.resetFields();
    setEditing(null);
    load();
  };

  const handleDeactivate = async (id: string) => {
    await api.deleteManufacturer(id);
    message.success('Производитель деактивирован');
    load();
  };

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Производители ({total})</h2>
        <Space>
          <Input.Search
            placeholder="Поиск по названию или стране"
            allowClear
            onSearch={(v) => { setSearch(v); setPage(1); }}
            style={{ width: 280 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            Добавить
          </Button>
        </Space>
      </div>
      <Table
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (t: number) => `Всего: ${t}`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        columns={[
          { title: 'Название', dataIndex: 'name', sorter: (a: any, b: any) => a.name.localeCompare(b.name) },
          { title: 'Страна', dataIndex: 'country', render: (v: string) => v || '—' },
          { title: 'Статус', dataIndex: 'isActive', width: 100, render: (v: boolean) => v ? <Tag color="green">Активен</Tag> : <Tag color="red">Неактивен</Tag> },
          {
            title: '',
            key: 'actions',
            width: 100,
            render: (_: any, r: any) => (
              <Space>
                <Button type="text" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
                {r.isActive && (
                  <Popconfirm title="Деактивировать производителя?" onConfirm={() => handleDeactivate(r.id)}>
                    <Button type="text" danger icon={<StopOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Редактировать производителя' : 'Новый производитель'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="country" label="Страна">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
