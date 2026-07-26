import { useEffect, useState } from 'react';
import { Table, Button, Select, Space, App, Popconfirm, Tag, Input, Checkbox } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { api } from '../../api/client';
import { REQUEST_TYPE_LABELS, PROPOSAL_STATUS_LABELS } from '@shared/types';
import type { RequestType, ProposalStatus } from '@shared/types';
import dayjs from 'dayjs';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: 'Ожидает' },
  approved: { color: 'success', label: 'Утверждено' },
  rejected: { color: 'error', label: 'Отклонено' },
  expired: { color: 'warning', label: 'Истекло' },
};

const REQUEST_TYPE_ICONS: Record<string, string> = {
  new_equipment: '➕',
  room_change: '🔄',
  brand_change: '✏️',
};

export default function AdminProposals() {
  const { message, modal } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [requestTypeFilter, setRequestTypeFilter] = useState<string>('');
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [summary, setSummary] = useState({ total: 0, pending: 0, expiringSoon: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (requestTypeFilter) params.request_type = requestTypeFilter;
      if (expiringSoon) params.expiring_soon = 'true';
      const result = await api.getProposals(params);
      setData(result.data || result);
      if (result.summary) setSummary(result.summary);
    } catch {
      message.error('Ошибка загрузки предложений');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter, requestTypeFilter, expiringSoon]);

  const handleApprove = async (id: string) => {
    try {
      await api.approveProposal(id);
      message.success('Предложение утверждено');
      load();
    } catch (err: any) {
      message.error(err.message || 'Ошибка утверждения');
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    try {
      await api.rejectProposal(id, reason);
      message.success('Предложение отклонено');
      setRejectModalId(null);
      setRejectReason('');
      load();
    } catch (err: any) {
      message.error(err.message || 'Ошибка отклонения');
    }
  };

  const handleBatch = async (action: 'approve' | 'reject') => {
    if (selectedIds.length === 0) return;
    try {
      const result = await api.batchProposals({ ids: selectedIds, action });
      message.success(`${action === 'approve' ? 'Утверждено' : 'Отклонено'}: ${result.approved || result.rejected || selectedIds.length}`);
      if (result.errors?.length > 0) {
        message.warning(`Ошибок: ${result.errors.length}`);
      }
      setSelectedIds([]);
      load();
    } catch (err: any) {
      message.error(err.message || 'Ошибка массовой операции');
    }
  };

  const columns = [
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Тип',
      dataIndex: 'requestType',
      key: 'requestType',
      width: 140,
      render: (v: RequestType) => (
        <span>{REQUEST_TYPE_ICONS[v] || ''} {REQUEST_TYPE_LABELS[v] || v}</span>
      ),
    },
    {
      title: 'Объект',
      key: 'address',
      render: (_: any, r: any) => r.address?.fullAddress || '—',
      ellipsis: true,
    },
    {
      title: 'Оборудование',
      key: 'equipment',
      render: (_: any, r: any) => {
        const name = [r.brand, r.model].filter(Boolean).join(' ') || r.equipmentTypeCode;
        const sn = r.serialNumber ? `SN: ${r.serialNumber}` : '';
        return (
          <div>
            <div>{name}</div>
            {sn && <div style={{ fontSize: 12, color: '#888' }}>{sn}</div>}
          </div>
        );
      },
    },
    {
      title: 'Помещение',
      key: 'room',
      width: 180,
      render: (_: any, r: any) => {
        if (r.requestType === 'room_change' && r.oldRoomTypeCode) {
          return (
            <span>
              <span style={{ color: '#999', textDecoration: 'line-through' }}>{r.oldRoomTypeCode}</span>
              {' → '}
              <strong>{r.roomTypeCode}</strong>
            </span>
          );
        }
        return r.roomTypeCode || '—';
      },
    },
    {
      title: 'Инженер',
      key: 'proposedBy',
      width: 140,
      render: (_: any, r: any) => r.proposedBy?.fullName || '—',
    },
    {
      title: 'Срок',
      dataIndex: 'pendingUntil',
      key: 'pendingUntil',
      width: 110,
      render: (v: string, r: any) => {
        if (!v || r.status !== 'pending') return '—';
        const daysLeft = Math.ceil((dayjs(v).valueOf() - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysLeft <= 0) return <Tag color="error">Истёк</Tag>;
        if (daysLeft <= 3) return <Tag color="warning">{daysLeft} дн.</Tag>;
        return dayjs(v).format('DD.MM.YYYY');
      },
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 110,
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
              <Button danger size="small" icon={<CloseOutlined />} onClick={() => setRejectModalId(r.id)}>Отклонить</Button>
            </Space>
          );
        }
        return (
          <span style={{ fontSize: 12, color: '#888' }}>
            {r.reviewedBy?.fullName || '—'}
            {r.reviewedAt ? `, ${dayjs(r.reviewedAt).format('DD.MM.YYYY HH:mm')}` : ''}
            {r.rejectionReason && <div style={{ color: '#c00' }}>{r.rejectionReason}</div>}
          </span>
        );
      },
    },
  ];

  const rowSelection = statusFilter === 'pending' ? {
    selectedRowKeys: selectedIds,
    onChange: (keys: React.Key[]) => setSelectedIds(keys as string[]),
  } : undefined;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>
          Модерация оборудования
          {summary.pending > 0 && <Tag color="processing" style={{ marginLeft: 8 }}>{summary.pending} ожидают</Tag>}
          {summary.expiringSoon > 0 && <Tag color="warning" style={{ marginLeft: 4 }}>{summary.expiringSoon} истекают</Tag>}
        </h2>
        <Space wrap>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            options={[
              { value: 'pending', label: 'Ожидающие' },
              { value: 'approved', label: 'Утверждённые' },
              { value: 'rejected', label: 'Отклонённые' },
              { value: 'expired', label: 'Истёкшие' },
              { value: '', label: 'Все' },
            ]}
          />
          <Select
            value={requestTypeFilter}
            onChange={setRequestTypeFilter}
            style={{ width: 170 }}
            placeholder="Тип запроса"
            allowClear
            options={[
              { value: 'new_equipment', label: '➕ Новое оборудование' },
              { value: 'room_change', label: '🔄 Перенос' },
              { value: 'brand_change', label: '✏️ Смена бренда' },
            ]}
          />
          <Checkbox checked={expiringSoon} onChange={(e) => setExpiringSoon(e.target.checked)}>
            Истекают скоро
          </Checkbox>
        </Space>
      </div>

      {statusFilter === 'pending' && selectedIds.length > 0 && (
        <Space style={{ marginBottom: 12 }}>
          <span>Выбрано: {selectedIds.length}</span>
          <Popconfirm title={`Утвердить ${selectedIds.length} предложений?`} onConfirm={() => handleBatch('approve')} okText="Да" cancelText="Нет">
            <Button type="primary" size="small" icon={<CheckOutlined />}>Утвердить выбранные</Button>
          </Popconfirm>
          <Button danger size="small" icon={<CloseOutlined />} onClick={() => { setRejectModalId('batch'); }}>Отклонить выбранные</Button>
        </Space>
      )}

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], showTotal: (total: number) => `Всего: ${total}` }}
        locale={{ emptyText: 'Нет предложений' }}
      />

      {/* Модалка отклонения с причиной */}
      {rejectModalId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 400, maxWidth: 500 }}>
            <h3>Отклонить {rejectModalId === 'batch' ? `${selectedIds.length} предложений` : 'предложение'}</h3>
            <Input.TextArea
              rows={3}
              placeholder="Причина отклонения (необязательно)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => { setRejectModalId(null); setRejectReason(''); }}>Отмена</Button>
                <Button danger onClick={() => {
                  if (rejectModalId === 'batch') {
                    handleBatch('reject');
                  } else {
                    handleReject(rejectModalId, rejectReason || undefined);
                  }
                }}>Отклонить</Button>
              </Space>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
