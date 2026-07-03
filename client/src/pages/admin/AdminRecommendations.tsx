import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Space, App, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../api/client';

export default function AdminRecommendations() {
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [filterEq, setFilterEq] = useState<string>('');

  const load = async () => {
    setLoading(true);
    const params: any = {};
    if (filterEq) params.equipment_type_id = filterEq;
    setData(await api.adminGet('recommendations', params));
    setLoading(false);
  };

  useEffect(() => { api.adminGet('equipment-types').then(setEquipmentTypes); }, []);
  useEffect(() => { load(); }, [filterEq]);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editing) await api.adminUpdate('recommendations', editing.id, values);
    else await api.adminCreate('recommendations', values);
    setModalOpen(false); form.resetFields(); setEditing(null); load();
  };

  const handleDelete = async (id: string) => { await api.adminDelete('recommendations', id); load(); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Типовые рекомендации</h2>
        <Space>
          <Select placeholder="Фильтр по оборудованию" allowClear style={{ width: 250 }} onChange={setFilterEq}
            options={equipmentTypes.map(e => ({ label: e.name, value: e.id }))} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>Добавить</Button>
        </Space>
      </div>
      <Table dataSource={data} rowKey="id" loading={loading} pagination={false} columns={[
        { title: 'Оборудование', render: (_: any, r: any) => equipmentTypes.find(e => e.id === r.equipmentTypeId)?.name || '—' },
        { title: 'Текст', dataIndex: 'text', ellipsis: true },
        { title: 'Порядок', dataIndex: 'sortOrder', width: 80 },
        { title: '', key: 'actions', width: 100, render: (_: any, r: any) => (
          <Space>
            <Button type="text" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
            <Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </Space>
        )},
      ]} />
      <Modal title={editing ? 'Редактировать' : 'Новая рекомендация'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="equipmentTypeId" label="Оборудование" rules={[{ required: true }]}>
            <Select options={equipmentTypes.map(e => ({ label: e.name, value: e.id }))} />
          </Form.Item>
          <Form.Item name="text" label="Текст рекомендации" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="sortOrder" label="Порядок"><InputNumber /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
