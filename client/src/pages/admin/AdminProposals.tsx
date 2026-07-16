import { useEffect, useState } from 'react';
import { Table, Button, Select, Space, App, Popconfirm, Tag } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { api } from '../../api/client';
import dayjs from 'dayjs';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: 'Ожидает' },
  approved: { color: 'success', label: 'Утверждено' },
  rejected: { color: 'error', label: 'Отклонено' },
};

export default function AdminProposals() {
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const load = async (status: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      const result = await api.getProposals(params);
      setData(result);
    } catch {
      message.error('Ошибка загрузки предложений');
    }
    setLoading(false);
  };

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  const handleApprove = async (id: string) => {
    try {
      await api.approveProposal(id);
      message.success('Предложение утверждено');
      load(statusFilter);
    } catch (err: any) {
      message.error(err.message || 'Ошибка утверждения');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectProposal(id);
      message.success('Предложение отклонено');
      load(statusFilter);
    } catch (err: any) {
      message.error(err.message || 'Ошибка отклонения');
    }
  };

  const columns = [
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Объект',
      key: 'address',
      render: (_: any, r: any) => r.address?.fullAddress || '—',
      ellipsis: true,
    },
    {
      title: 'Тип оборудования',
      dataIndex: 'equipmentTypeCode',
      key: 'equipmentTypeCode',
    },
    {
      title: 'Помещение',
      dataIndex: 'roomTypeCode',
      key: 'roomTypeCode',
    },
    {
      title: 'Марка/Модель',
      key: 'brandModel',
      render: (_: any, r: any) => [r.brand, r.model].filter(Boolean).join(' ') || '—',
    },
    {
      title: 'SN',
      dataIndex: 'serialNumber',
      key: 'serialNumber',
      render: (v: string) => v || '—',
    },
    {
      title: 'Предложил',
      key: 'proposedBy',
      render: (_: any, r: any) => r.proposedBy?.fullName || '—',
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => {
        const s = STATUS_MAP[v] || STATUS_MAP.pending;
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_: any, r: any) => {
        if (r.status === 'pending') {
          return (
            <Space>
              <Popconfirm title="Утвердить предложение?" onConfirm={() => handleApprove(r.id)} okText="Да" cancelText="Нет">
                <Button type="primary" size="small" icon={<CheckOutlined />}>Утвердить</Button>
              </Popconfirm>
              <Popconfirm title="Отклонить предложение?" onConfirm={() => handleReject(r.id)} okText="Да" cancelText="Нет">
                <Button danger size="small" icon={<CloseOutlined />}>Отклонить</Button>
              </Popconfirm>
            </Space>
          );
        }
        return (
          <span style={{ fontSize: 12, color: '#888' }}>
            {r.reviewedBy?.fullName || '—'}{r.reviewedAt ? `, ${dayjs(r.reviewedAt).format('DD.MM.YYYY HH:mm')}` : ''}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Утверждение оборудования</h2>
        <Select
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          style={{ width: 180 }}
          options={[
            { value: 'pending', label: 'Ожидающие' },
            { value: 'approved', label: 'Утверждённые' },
            { value: 'rejected', label: 'Отклонённые' },
            { value: '', label: 'Все' },
          ]}
        />
      </div>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], showTotal: (total: number) => `Всего: ${total}` }}
        locale={{ emptyText: 'Нет предложений' }}
      />
    </div>
  );
}
