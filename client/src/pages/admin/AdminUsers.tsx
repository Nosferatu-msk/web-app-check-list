import { useEffect, useState, useCallback, useRef } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Space, App, Popconfirm, Tag, Checkbox } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CloseCircleOutlined, LockOutlined } from '@ant-design/icons';
import { api } from '../../api/client';

const SPEC_LABELS: Record<string, string> = {
  vik: 'ВиК (Вентиляция и Кондиционирование)',
  iszh: 'ИСЖ (Инженерные Сети и Электрика)',
  gpm: 'ГПМ (Грузоподъёмные механизмы)',
  dgu: 'ДГУ (Дизель-генераторные установки)',
  ibp: 'ИБП (Источники бесперебойного питания)',
};

function getSpecDisplay(record: any): string {
  if (record.role !== 'engineer') return '—';
  const parts: string[] = [];
  if (record.specializationVik) parts.push('ВиК');
  if (record.specializationIszh) parts.push('ИСЖ');
  if (record.specializationGpm) parts.push('ГПМ');
  if (record.specializationDgu) parts.push('ДГУ');
  if (record.specializationIbp) parts.push('ИБП');
  return parts.length ? parts.join(' + ') : '—';
}

export default function AdminUsers() {
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');
  const [roleValue, setRoleValue] = useState<string | undefined>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      setData(await api.adminGet('users', q ? { search: q } : undefined));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 300);
  };

  const handleClearSearch = () => {
    setSearch('');
    load('');
  };

  const handleRoleChange = (value: string) => {
    setRoleValue(value);
    if (value !== 'engineer') {
      form.setFieldsValue({ specializationVik: false, specializationIszh: false, specializationGpm: false, specializationDgu: false, specializationIbp: false });
    }
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (values.role === 'engineer' && !values.specializationVik && !values.specializationIszh && !values.specializationGpm && !values.specializationDgu && !values.specializationIbp) {
      message.error('Выберите хотя бы одну специализацию');
      return;
    }
    if (values.role !== 'engineer') {
      values.specializationVik = false;
      values.specializationIszh = false;
      values.specializationGpm = false;
      values.specializationDgu = false;
      values.specializationIbp = false;
    }
    try {
      if (editing) {
        await api.adminUpdate('users', editing.id, values);
      } else {
        await api.adminCreate('users', values);
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      setRoleValue(undefined);
      load(search);
    } catch (err: any) {
      message.error(err?.message || err?.error || 'Ошибка сохранения');
    }
  };

  const handleDelete = async (id: string) => { await api.adminDelete('users', id); load(search); };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setRoleValue(undefined);
    setModalOpen(true);
  };

  const openEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      password: '',
      specializationVik: record.specializationVik ?? false,
      specializationIszh: record.specializationIszh ?? false,
      specializationGpm: record.specializationGpm ?? false,
      specializationDgu: record.specializationDgu ?? false,
      specializationIbp: record.specializationIbp ?? false,
    });
    setRoleValue(record.role);
    setModalOpen(true);
  };

  const isEngineer = roleValue === 'engineer';

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Пользователи</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>
      </div>

      <div style={{ marginBottom: 16, maxWidth: 400 }}>
        <Input
          placeholder="Поиск по ФИО или email..."
          prefix={<SearchOutlined />}
          suffix={search ? <CloseCircleOutlined style={{ cursor: 'pointer', color: '#bbb' }} onClick={handleClearSearch} /> : null}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          onPressEnter={() => load(search)}
          allowClear={false}
        />
      </div>

      {data.length >= 50 && search && (
        <div style={{ marginBottom: 8, color: '#faad14', fontSize: 13 }}>
          ⚠ Найдено 50+ записей — уточните запрос для более точного результата
        </div>
      )}

      <Table dataSource={data} rowKey="id" loading={loading} pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50], showTotal: (total: number) => `Всего: ${total}` }} columns={[
        { title: 'ФИО', dataIndex: 'fullName' },
        { title: 'Email', dataIndex: 'email' },
        { title: 'Роль', dataIndex: 'role', render: (v: string) => {
          const colors: Record<string, string> = { admin: 'red', tm: 'orange', engineer: 'blue' };
          const labels: Record<string, string> = { admin: 'Администратор', tm: 'ТМ', engineer: 'Инженер' };
          return <Tag color={colors[v] || 'default'}>{labels[v] || v}</Tag>;
        }},
        { title: 'Спец.', key: 'specialization', render: (_: any, r: any) => {
          const spec = getSpecDisplay(r);
          return spec === '—' ? <span style={{ color: '#bbb' }}>—</span> : <Tag color="cyan">{spec}</Tag>;
        }},
        { title: 'Активен', dataIndex: 'isActive', render: (v: boolean) => v ? '✅' : '❌' },
        { title: '', key: 'actions', width: 100, render: (_: any, r: any) => (
          <Space>
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
            <Popconfirm title="Деактивировать?" onConfirm={() => handleDelete(r.id)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </Space>
        )},
      ]} />

      <Modal title={editing ? `Редактировать: ${editing.fullName}` : 'Новый пользователь'} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setRoleValue(undefined); }}>
        <Form form={form} layout="vertical" initialValues={{ role: 'engineer', isActive: true, specializationVik: false, specializationIszh: false, specializationGpm: false, specializationDgu: false, specializationIbp: false }}>
          <Form.Item name="fullName" label="ФИО" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label={editing ? 'Новый пароль (оставьте пустым)' : 'Пароль'} rules={editing ? [] : [{ required: true, min: 6 }]}><Input.Password /></Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
            <Select options={[{ label: 'Инженер', value: 'engineer' }, { label: 'Территориальный менеджер', value: 'tm' }, { label: 'Администратор', value: 'admin' }]} onChange={handleRoleChange} />
          </Form.Item>

          {isEngineer && (
            <Form.Item label="Специализация" required style={{ marginBottom: 8 }}>
              <Form.Item name="specializationVik" valuePropName="checked" noStyle>
                <Checkbox>{SPEC_LABELS.vik}</Checkbox>
              </Form.Item>
              <Form.Item name="specializationIszh" valuePropName="checked" noStyle>
                <Checkbox>{SPEC_LABELS.iszh}</Checkbox>
              </Form.Item>
              <Form.Item name="specializationGpm" valuePropName="checked" noStyle>
                <Checkbox>{SPEC_LABELS.gpm}</Checkbox>
              </Form.Item>
              <Form.Item name="specializationDgu" valuePropName="checked" noStyle>
                <Checkbox>{SPEC_LABELS.dgu}</Checkbox>
              </Form.Item>
              <Form.Item name="specializationIbp" valuePropName="checked" noStyle>
                <Checkbox>{SPEC_LABELS.ibp}</Checkbox>
              </Form.Item>
              <div style={{ marginTop: 8 }}>
                <Checkbox disabled><LockOutlined /> Газ (Скоро будет доступно)</Checkbox>
              </div>
            </Form.Item>
          )}

          <Form.Item name="isActive" label="Активен" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
