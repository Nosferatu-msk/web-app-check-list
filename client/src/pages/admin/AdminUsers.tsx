import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Space, App, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../api/client';

export default function AdminUsers() {
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => { setLoading(true); setData(await api.adminGet('users')); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editing) await api.adminUpdate('users', editing.id, values);
    else await api.adminCreate('users', values);
    setModalOpen(false); form.resetFields(); setEditing(null); load();
  };

  const handleDelete = async (id: string) => { await api.adminDelete('users', id); load(); };

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Пользователи</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>Добавить</Button>
      </div>
      <Table dataSource={data} rowKey="id" loading={loading} pagination={false} columns={[
        { title: 'ФИО', dataIndex: 'fullName' },
        { title: 'Email', dataIndex: 'email' },
        { title: 'Роль', dataIndex: 'role', render: (v: string) => {
          const colors: Record<string, string> = { admin: 'red', tm: 'orange', engineer: 'blue' };
          const labels: Record<string, string> = { admin: 'Администратор', tm: 'ТМ', engineer: 'Инженер' };
          return <Tag color={colors[v] || 'default'}>{labels[v] || v}</Tag>;
        }},
        { title: 'Активен', dataIndex: 'isActive', render: (v: boolean) => v ? '✅' : '❌' },
        { title: '', key: 'actions', width: 100, render: (_: any, r: any) => (
          <Space>
            <Button type="text" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue({ ...r, password: '' }); setModalOpen(true); }} />
            <Popconfirm title="Деактивировать?" onConfirm={() => handleDelete(r.id)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </Space>
        )},
      ]} />
      <Modal title={editing ? 'Редактировать' : 'Новый пользователь'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="fullName" label="ФИО" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label={editing ? 'Новый пароль (оставьте пустым)' : 'Пароль'} rules={editing ? [] : [{ required: true, min: 6 }]}><Input.Password /></Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
            <Select options={[{ label: 'Инженер', value: 'engineer' }, { label: 'Территориальный менеджер', value: 'tm' }, { label: 'Администратор', value: 'admin' }]} />
          </Form.Item>
          <Form.Item name="isActive" label="Активен" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
