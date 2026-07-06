import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, App, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../api/client';

export default function AdminAddresses() {
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');

  const generateFullAddress = () => {
    const city = form.getFieldValue('city');
    const street = form.getFieldValue('street');
    const house = form.getFieldValue('house');
    const building = form.getFieldValue('building');

    const parts: string[] = [];
    if (city) parts.push(`г. ${city}`);
    if (street) parts.push(`ул. ${street}`);
    if (house) parts.push(`д.${house}`);
    if (building) parts.push(`к.${building}`);

    form.setFieldValue('fullAddress', parts.join(', '));
  };

  const load = async (p = page, q = search) => {
    setLoading(true);
    const params: any = { page: String(p), pageSize: '20' };
    if (q) params.q = q;
    const res = await api.adminGet('addresses', params);
    setData(res.data || []);
    setTotal(res.total || 0);
    setLoading(false);
  };

  useEffect(() => { load(1); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editing) {
      await api.adminUpdate('addresses', editing.id, values);
      message.success('Обновлено');
    } else {
      await api.adminCreate('addresses', values);
      message.success('Создано');
    }
    setModalOpen(false);
    form.resetFields();
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.adminDelete('addresses', id);
    message.success('Удалено');
    load();
  };

  const columns = [
    { title: 'Адрес', dataIndex: 'fullAddress', key: 'fullAddress' },
    { title: 'Email заказчика', dataIndex: 'customerEmail', key: 'customerEmail', render: (v: string) => v || '—' },
    {
      title: 'Действия', key: 'actions', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
          <Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)} okText="Да" cancelText="Нет">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Справочник адресов</h2>
        <Space>
          <Input.Search placeholder="Поиск..." onSearch={(v) => { setSearch(v); load(1, v); }} allowClear style={{ width: 250 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>Добавить</Button>
        </Space>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      <Modal title={editing ? 'Редактировать адрес' : 'Новый адрес'} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }} okText="Сохранить">
        <Form form={form} layout="vertical">
          <Form.Item name="city" label="Город" rules={[{ required: true }]}><Input onChange={generateFullAddress} /></Form.Item>
          <Form.Item name="street" label="Улица" rules={[{ required: true }]}><Input onChange={generateFullAddress} /></Form.Item>
          <Form.Item name="house" label="Дом" rules={[{ required: true }]}><Input onChange={generateFullAddress} /></Form.Item>
          <Form.Item name="building" label="Строение/корпус"><Input onChange={generateFullAddress} /></Form.Item>
          <Form.Item name="fullAddress" label="Полный адрес" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="customerEmail" label="Email заказчика"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
