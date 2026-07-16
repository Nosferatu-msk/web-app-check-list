import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, App, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../api/client';

export default function AdminObjectEquipment() {
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [equipmentTypes, setEquipmentTypes] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (selectedAddressId) params.address_id = selectedAddressId;
    setData(await api.adminGet('object-equipment', params));
    setLoading(false);
  };

  const loadRefs = async () => {
    const [eqTypes, rmTypes] = await Promise.all([
      api.adminGet('equipment-types'),
      api.adminGet('room-types'),
    ]);
    setEquipmentTypes(eqTypes || []);
    setRoomTypes(rmTypes || []);
  };

  const searchAddresses = async (q: string) => {
    if (q.length < 2) { setAddresses([]); return; }
    const data = await api.adminGet('addresses/search', { q });
    setAddresses(data || []);
  };

  useEffect(() => { load(); loadRefs(); }, [selectedAddressId]);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editing) await api.adminUpdate('object-equipment', editing.id, values);
    else await api.adminCreate('object-equipment', values);
    setModalOpen(false); form.resetFields(); setEditing(null); load();
    message.success(editing ? 'Обновлено' : 'Добавлено');
  };

  const handleDelete = async (id: string) => {
    await api.adminDelete('object-equipment', id);
    message.success('Удалено');
    load();
  };

  const eqTypeMap = new Map(equipmentTypes.map((e: any) => [e.code, e.name]));
  const rmTypeMap = new Map(roomTypes.map((r: any) => [r.code, r.name]));

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Оборудование объектов</h2>
        <Space>
          <Select
            showSearch
            allowClear
            placeholder="Фильтр по объекту..."
            style={{ width: 300 }}
            onSearch={searchAddresses}
            onChange={(v) => setSelectedAddressId(v || '')}
            filterOption={false}
            options={addresses.map((a: any) => ({ value: a.id, label: a.fullAddress }))}
            notFoundContent="Введите минимум 2 символа"
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>Добавить</Button>
        </Space>
      </div>

      <Table dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], showTotal: (total: number) => `Всего: ${total}` }} columns={[
        { title: 'Тип оборудования', dataIndex: 'equipmentTypeCode', render: (v: string) => eqTypeMap.get(v) || v },
        { title: 'Помещение', dataIndex: 'roomTypeCode', render: (v: string) => rmTypeMap.get(v) || v },
        { title: 'Марка', dataIndex: 'brand' },
        { title: 'Модель', dataIndex: 'model' },
        { title: 'Серийный №', dataIndex: 'serialNumber' },
        { title: 'Местоположение', dataIndex: 'locationDescription', ellipsis: true },
        { title: '', key: 'actions', width: 100, render: (_: any, r: any) => (
          <Space>
            <Button type="text" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
            <Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </Space>
        )},
      ]} />

      <Modal title={editing ? 'Редактировать оборудование' : 'Добавить оборудование'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="addressId" label="Объект" rules={[{ required: true }]}>
            <Select
              showSearch
              onSearch={searchAddresses}
              filterOption={false}
              options={addresses.map((a: any) => ({ value: a.id, label: a.fullAddress }))}
              notFoundContent="Введите минимум 2 символа"
            />
          </Form.Item>
          <Form.Item name="equipmentTypeCode" label="Тип оборудования" rules={[{ required: true }]}>
            <Select options={equipmentTypes.map((e: any) => ({ value: e.code, label: e.name }))} />
          </Form.Item>
          <Form.Item name="roomTypeCode" label="Тип помещения" rules={[{ required: true }]}>
            <Select options={roomTypes.map((r: any) => ({ value: r.code, label: r.name }))} />
          </Form.Item>
          <Form.Item name="brand" label="Марка"><Input /></Form.Item>
          <Form.Item name="model" label="Модель"><Input /></Form.Item>
          <Form.Item name="serialNumber" label="Серийный номер"><Input /></Form.Item>
          <Form.Item name="locationDescription" label="Местоположение"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
