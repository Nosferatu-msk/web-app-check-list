import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, Select, Space, App, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { api } from '../../api/client';

const SPEC_OPTIONS = [
  { value: '', label: '— Все специализации —' },
  { value: 'vik', label: 'ВиК (Вентиляция и Кондиционирование)' },
  { value: 'iszh', label: 'ИСЖ (Инженерные Сети и Электрика)' },
  { value: 'gpm', label: 'ГПМ (Грузоподъёмные механизмы)' },
  { value: 'dgu', label: 'ДГУ (Дизель-генераторные установки)' },
  { value: 'ibp', label: 'ИБП (Источники бесперебойного питания)' },
];

const SPEC_TAG_COLORS: Record<string, string> = {
  vik: 'blue',
  iszh: 'green',
  gpm: 'orange',
  dgu: 'purple',
  ibp: 'red',
};

const SPEC_SHORT: Record<string, string> = {
  vik: 'ВиК',
  iszh: 'ИСЖ',
  gpm: 'ГПМ',
  dgu: 'ДГУ',
  ibp: 'ИБП',
};

export default function AdminEquipment() {
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => { setLoading(true); setData(await api.adminGet('equipment-types')); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    const payload = { ...values, specializationReq: values.specializationReq || null };
    if (editing) await api.adminUpdate('equipment-types', editing.id, payload);
    else await api.adminCreate('equipment-types', payload);
    setModalOpen(false); form.resetFields(); setEditing(null); load();
    message.success(editing ? 'Обновлено' : 'Создано');
  };

  const handleDelete = async (id: string) => { await api.adminDelete('equipment-types', id); message.success('Удалено'); load(); };

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Виды оборудования</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>Добавить</Button>
      </div>
      <Table dataSource={data} rowKey="id" loading={loading} pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50], showTotal: (total: number) => `Всего: ${total}` }} columns={[
        { title: 'Название', dataIndex: 'name' },
        { title: 'Код', dataIndex: 'code' },
        { title: 'Фото', dataIndex: 'photosRequired' },
        { title: 'Специализация', dataIndex: 'specializationReq', width: 140, render: (v: string | null) => v ? <Tag color={SPEC_TAG_COLORS[v]}>{SPEC_SHORT[v] || v}</Tag> : <span style={{ color: '#999' }}>Все</span> },
        { title: 'Активен', dataIndex: 'isActive', render: (v: boolean) => v ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> },
        { title: '', key: 'actions', width: 100, render: (_: any, r: any) => (
          <Space>
            <Button type="text" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue({ ...r, specializationReq: r.specializationReq || '' }); setModalOpen(true); }} />
            <Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </Space>
        )},
      ]} />
      <Modal title={editing ? 'Редактировать' : 'Новый вид'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="Код (транслит)" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="photosRequired" label="Количество фото" rules={[{ required: true }]}><InputNumber min={1} max={2} /></Form.Item>
          <Form.Item name="specializationReq" label="Специализация" initialValue="">
            <Select options={SPEC_OPTIONS} />
          </Form.Item>
          <Form.Item name="isActive" label="Активен" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
