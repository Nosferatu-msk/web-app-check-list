import { useEffect, useState, useMemo } from 'react';
import { Button, Select, Space, App, Popconfirm, Tag, Input, Checkbox, Card, Row, Col, Empty, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, SortAscendingOutlined, SortDescendingOutlined, EnvironmentOutlined, ToolOutlined, UserOutlined, HomeOutlined } from '@ant-design/icons';
import { api } from '../../api/client';
import { REQUEST_TYPE_LABELS } from '@shared/types';
import type { RequestType } from '@shared/types';
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
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [requestTypeFilter, setRequestTypeFilter] = useState<string>('');
  const [engineerFilter, setEngineerFilter] = useState<string>('');
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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

  const engineers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    data.forEach((r) => {
      if (r.proposedBy?.id && !map.has(r.proposedBy.id)) {
        map.set(r.proposedBy.id, { id: r.proposedBy.id, name: r.proposedBy.fullName });
      }
    });
    return Array.from(map.values());
  }, [data]);

  const filteredData = useMemo(() => {
    let items = [...data];
    if (engineerFilter) {
      items = items.filter((r) => r.proposedBy?.id === engineerFilter);
    }
    items.sort((a, b) => {
      const da = dayjs(a.createdAt).valueOf();
      const db = dayjs(b.createdAt).valueOf();
      return sortOrder === 'desc' ? db - da : da - db;
    });
    return items;
  }, [data, engineerFilter, sortOrder]);

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    const pendingIds = filteredData.filter((r) => r.status === 'pending').map((r) => r.id);
    const allSelected = pendingIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pendingIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pendingIds])]);
    }
  };

  const getDaysLeft = (v: string) => Math.ceil((dayjs(v).valueOf() - Date.now()) / (24 * 60 * 60 * 1000));

  const renderProposalCard = (r: any) => {
    const isSelected = selectedIds.includes(r.id);
    const isPending = r.status === 'pending';
    const statusInfo = STATUS_MAP[r.status] || STATUS_MAP.pending;

    return (
      <Col xs={24} sm={12} xl={8} key={r.id}>
        <Card
          size="small"
          style={{
            border: isSelected ? '2px solid #1677ff' : '1px solid #f0f0f0',
            background: isSelected ? '#f0f5ff' : '#fff',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
          styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 16 } }}
        >
          {/* Шапка карточки */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              {isPending && (
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleSelect(r.id)}
                  style={{ flexShrink: 0 }}
                />
              )}
              <span style={{ fontSize: 16, flexShrink: 0 }}>{REQUEST_TYPE_ICONS[r.requestType] || ''}</span>
              <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {REQUEST_TYPE_LABELS[r.requestType as RequestType] || r.requestType}
              </span>
            </div>
            <Tag color={statusInfo.color} style={{ flexShrink: 0, marginLeft: 8 }}>{statusInfo.label}</Tag>
          </div>

          {/* Содержимое карточки */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <EnvironmentOutlined style={{ color: '#888', marginTop: 2, flexShrink: 0 }} />
              <span style={{ color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                {r.address?.fullAddress || '—'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <ToolOutlined style={{ color: '#888', marginTop: 2, flexShrink: 0 }} />
              <div>
                <div>{[r.brand, r.model].filter(Boolean).join(' ') || r.equipmentTypeCode || '—'}</div>
                {r.serialNumber && <div style={{ fontSize: 12, color: '#888' }}>SN: {r.serialNumber}</div>}
              </div>
            </div>

            {r.requestType === 'room_change' && r.oldRoomTypeCode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <HomeOutlined style={{ color: '#888', flexShrink: 0 }} />
                <span>
                  <span style={{ color: '#999', textDecoration: 'line-through' }}>{r.oldRoomTypeCode}</span>
                  {' → '}
                  <strong>{r.roomTypeCode}</strong>
                </span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserOutlined style={{ color: '#888', flexShrink: 0 }} />
              <span style={{ color: '#555' }}>{r.proposedBy?.fullName || '—'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 4 }}>
              <span style={{ fontSize: 12, color: '#999' }}>
                {dayjs(r.createdAt).format('DD.MM.YYYY HH:mm')}
              </span>
              {r.pendingUntil && r.status === 'pending' && (() => {
                const daysLeft = getDaysLeft(r.pendingUntil);
                if (daysLeft <= 0) return <Tag color="error" style={{ marginRight: 0 }}>Истёк</Tag>;
                if (daysLeft <= 3) return <Tag color="warning" style={{ marginRight: 0 }}>{daysLeft} дн.</Tag>;
                return <span style={{ fontSize: 12, color: '#999' }}>до {dayjs(r.pendingUntil).format('DD.MM')}</span>;
              })()}
            </div>
          </div>

          {/* Действия */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 12 }}>
            {isPending ? (
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Popconfirm title="Утвердить предложение?" onConfirm={() => handleApprove(r.id)} okText="Да" cancelText="Нет">
                  <Button type="primary" size="small" icon={<CheckOutlined />}>Утвердить</Button>
                </Popconfirm>
                <Button danger size="small" icon={<CloseOutlined />} onClick={() => setRejectModalId(r.id)}>Отклонить</Button>
              </Space>
            ) : (
              <div style={{ fontSize: 12, color: '#888' }}>
                {r.reviewedBy?.fullName || '—'}
                {r.reviewedAt ? `, ${dayjs(r.reviewedAt).format('DD.MM.YYYY HH:mm')}` : ''}
                {r.rejectionReason && <div style={{ color: '#c00', marginTop: 2 }}>{r.rejectionReason}</div>}
              </div>
            )}
          </div>
        </Card>
      </Col>
    );
  };

  const pendingCount = filteredData.filter((r) => r.status === 'pending').length;
  const allPendingSelected = pendingCount > 0 && filteredData.filter((r) => r.status === 'pending').every((r) => selectedIds.includes(r.id));

  return (
    <div>
      {/* Заголовок */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>
          Модерация оборудования
          {summary.pending > 0 && <Tag color="processing" style={{ marginLeft: 8 }}>{summary.pending} ожидают</Tag>}
          {summary.expiringSoon > 0 && <Tag color="warning" style={{ marginLeft: 4 }}>{summary.expiringSoon} истекают</Tag>}
        </h2>
      </div>

      {/* Панель фильтров */}
      <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              options={[
                { value: 'pending', label: 'Ожидающие' },
                { value: 'approved', label: 'Утверждённые' },
                { value: 'rejected', label: 'Отклонённые' },
                { value: 'expired', label: 'Истёкшие' },
                { value: '', label: 'Все' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              value={requestTypeFilter}
              onChange={setRequestTypeFilter}
              style={{ width: '100%' }}
              placeholder="Тип запроса"
              allowClear
              options={[
                { value: 'new_equipment', label: '➕ Новое оборудование' },
                { value: 'room_change', label: '🔄 Перенос' },
                { value: 'brand_change', label: '✏️ Смена бренда' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              value={engineerFilter || undefined}
              onChange={(v) => setEngineerFilter(v || '')}
              style={{ width: '100%' }}
              placeholder="Инженер"
              allowClear
              showSearch
              optionFilterProp="label"
              options={engineers.map((e) => ({ value: e.id, label: e.name }))}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Tooltip title={sortOrder === 'desc' ? 'Новые сначала' : 'Старые сначала'}>
              <Button
                block
                icon={sortOrder === 'desc' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
                onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
              >
                {sortOrder === 'desc' ? 'Новые ↓' : 'Старые ↑'}
              </Button>
            </Tooltip>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Checkbox checked={expiringSoon} onChange={(e) => setExpiringSoon(e.target.checked)}>
              Истекают скоро
            </Checkbox>
          </Col>
        </Row>
      </Card>

      {/* Массовые действия */}
      {statusFilter === 'pending' && selectedIds.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff', borderColor: '#adc6ff' }} styles={{ body: { padding: '10px 16px' } }}>
          <Space wrap>
            <span style={{ fontWeight: 600 }}>Выбрано: {selectedIds.length}</span>
            <Popconfirm title={`Утвердить ${selectedIds.length} предложений?`} onConfirm={() => handleBatch('approve')} okText="Да" cancelText="Нет">
              <Button type="primary" size="small" icon={<CheckOutlined />}>Утвердить выбранные</Button>
            </Popconfirm>
            <Button danger size="small" icon={<CloseOutlined />} onClick={() => { setRejectModalId('batch'); }}>Отклонить выбранные</Button>
            <Button size="small" onClick={() => setSelectedIds([])}>Сбросить выбор</Button>
          </Space>
        </Card>
      )}

      {/* Выбрать все / снять */}
      {statusFilter === 'pending' && filteredData.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Button type="link" size="small" onClick={toggleSelectAll} style={{ padding: 0 }}>
            {allPendingSelected ? 'Снять выделение' : `Выбрать все (${pendingCount})`}
          </Button>
        </div>
      )}

      {/* Карточки */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>Загрузка...</div>
      ) : filteredData.length === 0 ? (
        <Empty description="Нет предложений" style={{ padding: 48 }} />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredData.map(renderProposalCard)}
        </Row>
      )}

      {/* Модалка отклонения */}
      {rejectModalId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 340, maxWidth: 460, width: '90%' }}>
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
