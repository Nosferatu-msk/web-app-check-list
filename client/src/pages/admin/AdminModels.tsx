import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, App, Popconfirm, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { api } from '../../api/client';
import { MODEL_STATUS_LABELS } from '@shared/types/index';
import type { ModelStatus } from '@shared/types/index';

export default function AdminModels() {
  const { message, modal } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eqTypeFilter, setEqTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const [eqTypes, setEqTypes] = useState<any[]>([]);
  const [manufacturers, setManufacturers] = useState<any[]>([]);

  useEffect(() => {
    api.adminGet('equipment-types').then(setEqTypes);
    api.getManufacturersList().then(setManufacturers);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.getModels({
      page,
      pageSize,
      q: search || undefined,
      status: statusFilter || undefined,
      equipment_type_id: eqTypeFilter || undefined,
    });
    setData(res.data);
    setTotal(res.total);
    setLoading(false);
  }, [page, pageSize, search, statusFilter, eqTypeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const mfr = manufacturers.find((m: any) => m.id === values.manufacturerId);
    const fullModelName = mfr ? `${mfr.name} ${values.modelName}` : values.modelName;
    if (editing) {
      await api.updateModel(editing.id, { ...values, fullModelName });
      message.success('Модель обновлена');
    } else {
      await api.createModel({ ...values, fullModelName });
      message.success('Модель добавлена');
    }
    setModalOpen(false);
    form.resetFields();
    setEditing(null);
    load();
  };

  const handleApprove = async (id: string) => {
    await api.approveModel(id);
    message.success('Модель утверждена');
    load();
  };

  const handleReject = (id: string) => {
    modal.confirm({
      title: 'Отклонить модель?',
      content: (
        <Input.TextArea
          id="reject-reason"
          placeholder="Укажите причину отклонения"
          rows={3}
        />
      ),
      okText: 'Отклонить',
      okButtonProps: { danger: true },
      onOk: async () => {
        const reason = (document.getElementById('reject-reason') as HTMLTextAreaElement)?.value;
        await api.rejectModel(id, reason);
        message.success('Модель отклонена');
        load();
      },
    });
  };

  const statusColors: Record<ModelStatus, string> = {
    approved: 'green',
    pending: 'orange',
    rejected: 'red',
  };

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Модели оборудования ({total})</h2>
        <Space wrap>
          <Input.Search
            placeholder="Поиск по названию"
            allowClear
            onSearch={(v) => { setSearch(v); setPage(1); }}
            style={{ width: 220 }}
          />
          <Select
            placeholder="Статус"
            allowClear
            style={{ width: 160 }}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
            options={Object.entries(MODEL_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
          <Select
            placeholder="Вид оборудования"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            onChange={(v) => { setEqTypeFilter(v || ''); setPage(1); }}
            options={eqTypes.map((e: any) => ({ value: e.id, label: e.name }))}
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
        scroll={{ x: 900 }}
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
          {
            title: 'Модель',
            dataIndex: 'modelName',
            render: (v: string, r: any) => (
              <Tooltip title={r.fullModelName || ''}>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </Tooltip>
            ),
          },
          {
            title: 'Производитель',
            key: 'manufacturer',
            render: (_: any, r: any) => r.manufacturer?.name || '—',
          },
          {
            title: 'Вид оборудования',
            key: 'equipmentType',
            render: (_: any, r: any) => r.equipmentType?.name || '—',
          },
          {
            title: 'Статус',
            dataIndex: 'status',
            width: 140,
            render: (v: ModelStatus) => <Tag color={statusColors[v]}>{MODEL_STATUS_LABELS[v]}</Tag>,
          },
          {
            title: 'Предложил',
            key: 'submittedBy',
            width: 150,
            render: (_: any, r: any) => r.submittedBy?.fullName || '—',
          },
          {
            title: '',
            key: 'actions',
            width: 140,
            render: (_: any, r: any) => (
              <Space>
                <Button type="text" icon={<EditOutlined />} onClick={() => {
                  setEditing(r);
                  form.setFieldsValue({
                    equipmentTypeId: r.equipmentTypeId,
                    manufacturerId: r.manufacturerId,
                    modelName: r.modelName,
                  });
                  setModalOpen(true);
                }} />
                {r.status === 'pending' && (
                  <>
                    <Popconfirm title="Утвердить модель?" onConfirm={() => handleApprove(r.id)}>
                      <Button type="text" style={{ color: '#52c41a' }} icon={<CheckOutlined />} />
                    </Popconfirm>
                    <Button type="text" danger icon={<CloseOutlined />} onClick={() => handleReject(r.id)} />
                  </>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Редактировать модель' : 'Новая модель'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="equipmentTypeId" label="Вид оборудования" rules={[{ required: true, message: 'Выберите вид оборудования' }]}>
            <Select showSearch optionFilterProp="label" options={eqTypes.map((e: any) => ({ value: e.id, label: e.name }))} />
          </Form.Item>
          <Form.Item name="manufacturerId" label="Производитель" rules={[{ required: true, message: 'Выберите производителя' }]}>
            <Select showSearch optionFilterProp="label" options={manufacturers.map((m: any) => ({ value: m.id, label: m.name }))} />
          </Form.Item>
          <Form.Item name="modelName" label="Название модели" rules={[{ required: true, message: 'Введите название модели' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
