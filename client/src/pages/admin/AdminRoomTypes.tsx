import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, App, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../api/client';

export default function AdminRoomTypes() {
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => { setLoading(true); setData(await api.adminGet('room-types')); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editing) await api.adminUpdate('room-types', editing.id, values);
    else await api.adminCreate('room-types', values);
    setModalOpen(false); form.resetFields(); setEditing(null); load();
  };

  const handleDelete = async (id: string) => { await api.adminDelete('room-types', id); load(); };

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Типы помещений</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>Добавить</Button>
      </div>
      <Table dataSource={data} rowKey="id" loading={loading} pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50], showTotal: (total: number) => `Всего: ${total}` }} columns={[
        { title: 'Название', dataIndex: 'name' },
        { title: 'Код', dataIndex: 'code' },
        { title: '', key: 'actions', width: 100, render: (_: any, r: any) => (
          <Space>
            <Button type="text" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
            <Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </Space>
        )},
      ]} />
      <Modal title={editing ? 'Редактировать' : 'Новый тип'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="Код (транслит)" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
