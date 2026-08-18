import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Tag, Space, Card, Modal, Input, App, Empty, List, Segmented } from 'antd';
import { LogoutOutlined, CheckOutlined, CloseOutlined, ArrowLeftOutlined, SyncOutlined, ClockCircleOutlined, CheckCircleOutlined, SendOutlined, EditOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { VISIT_STATUS_LABELS } from '../../../shared/types/index';
import NotificationBell from '../components/NotificationBell';
import MobileHeader from '../components/MobileHeader';
import { useIsMobile } from '../hooks/useIsMobile';

const STATUS_COLORS: Record<string, string> = {
  planned: 'cyan',
  not_started: 'default',
  in_progress: 'processing',
  completed: 'success',
  sent: 'blue',
  sent_by_engineer: 'blue',
  sent_by_tm: 'geekblue',
  corrected_by_tm: 'purple',
  awaiting_assignment: 'orange',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  planned: <ClockCircleOutlined />,
  not_started: <MinusCircleOutlined />,
  in_progress: <SyncOutlined spin />,
  completed: <CheckCircleOutlined />,
  sent: <SendOutlined />,
  sent_by_engineer: <SendOutlined />,
  sent_by_tm: <SendOutlined />,
  corrected_by_tm: <EditOutlined />,
  awaiting_assignment: <ClockCircleOutlined />,
};

type TabKey = 'all' | 'new' | 'active' | 'done';

const TAB_OPTIONS: { value: TabKey; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'active', label: 'В работе' },
  { value: 'done', label: 'Завершённые' },
];

const NEW_STATUSES = ['planned', 'awaiting_assignment', 'not_started'];
const ACTIVE_STATUSES = ['in_progress'];
const DONE_STATUSES = ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'];

function filterByTab(requests: any[], tab: TabKey) {
  if (tab === 'all') return requests;
  const statuses = tab === 'new' ? NEW_STATUSES : tab === 'active' ? ACTIVE_STATUSES : DONE_STATUSES;
  return requests.filter(r => {
    if (!r.visit) return tab === 'new';
    return statuses.includes(r.visit.status);
  });
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [declineModal, setDeclineModal] = useState<{ visible: boolean; requestId?: string }>({ visible: false });
  const [declineReason, setDeclineReason] = useState('');
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { message } = App.useApp();
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getRequests({ pageSize: 100 });
      setRequests(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => filterByTab(requests, activeTab), [requests, activeTab]);

  const handleDecline = async () => {
    if (!declineModal.requestId || !declineReason) {
      message.error('Укажите причину отказа');
      return;
    }
    try {
      await api.declineRequest(declineModal.requestId, declineReason);
      message.success('Вы отказались от заявки');
      setDeclineModal({ visible: false });
      setDeclineReason('');
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const getActionButtons = (record: any, compact = false) => {
    if (!record.visit) return null;
    const status = record.visit.status;

    if (NEW_STATUSES.includes(status)) {
      return (
        <Space size={compact ? 4 : 8}>
          <Button
            type="primary"
            size={compact ? 'small' : 'middle'}
            icon={<CheckOutlined />}
            onClick={(e) => { e.stopPropagation(); navigate(`/visit/${record.visit.id}`); }}
          >
            {compact ? 'Начать' : 'Начать визит'}
          </Button>
          <Button
            danger
            size={compact ? 'small' : 'middle'}
            icon={<CloseOutlined />}
            onClick={(e) => { e.stopPropagation(); setDeclineModal({ visible: true, requestId: record.id }); }}
          >
            {compact ? 'Отказ' : 'Отказаться'}
          </Button>
        </Space>
      );
    }

    if (ACTIVE_STATUSES.includes(status)) {
      return (
        <Button
          type="primary"
          size={compact ? 'small' : 'middle'}
          icon={<SyncOutlined />}
          onClick={(e) => { e.stopPropagation(); navigate(`/visit/${record.visit.id}`); }}
        >
          {compact ? 'Продолжить' : 'Продолжить визит'}
        </Button>
      );
    }

    return null;
  };

  // ─── Десктоп: таблица ────────────────────────────────
  const columns: ColumnsType<any> = [
    {
      title: '№ заявки',
      dataIndex: 'externalRequestId',
      key: 'externalRequestId',
      width: 140,
    },
    {
      title: 'Вид оборудования',
      key: 'equipment',
      width: 180,
      render: (_: any, record: any) => record.equipmentType?.name || '-',
    },
    {
      title: 'Код объекта',
      dataIndex: 'objectCode',
      key: 'objectCode',
      width: 110,
    },
    {
      title: 'Адрес',
      key: 'address',
      render: (_: any, record: any) => record.matchedAddress?.fullAddress || record.addressRaw || '-',
    },
    {
      title: 'Статус',
      key: 'visitStatus',
      width: 150,
      render: (_: any, record: any) => {
        if (!record.visit) return <Tag>Без визита</Tag>;
        const label = VISIT_STATUS_LABELS[record.visit.status as keyof typeof VISIT_STATUS_LABELS] || record.visit.status;
        return <Tag color={STATUS_COLORS[record.visit.status] || 'default'}>{label}</Tag>;
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 240,
      render: (_: any, record: any) => getActionButtons(record),
    },
  ];

  // ─── Мобильный: карточки ────────────────────────────
  const renderMobileCard = (record: any) => {
    const visitStatus = record.visit?.status;
    const statusLabel = visitStatus
      ? (VISIT_STATUS_LABELS[visitStatus as keyof typeof VISIT_STATUS_LABELS] || visitStatus)
      : 'Без визита';
    const statusColor = STATUS_COLORS[visitStatus] || 'default';
    const statusIcon = STATUS_ICONS[visitStatus] || null;
    const address = record.matchedAddress?.fullAddress || record.addressRaw || '—';

    return (
      <div
        className="request-card"
        onClick={() => record.visit && navigate(`/visit/${record.visit.id}`)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              {statusIcon && (
                <span style={{ marginRight: 2, display: 'inline-flex', color: statusColor === 'processing' ? '#1677ff' : statusColor === 'success' ? '#52c41a' : statusColor === 'cyan' ? '#13c2c2' : statusColor === 'orange' ? '#fa8c16' : '#888' }}>
                  {statusIcon}
                </span>
              )}
              {record.objectCode && <Tag color="blue" style={{ marginRight: 2 }}>{record.objectCode}</Tag>}
              <span style={{ fontSize: 13, color: '#555' }}>{record.externalRequestId}</span>
            </div>
            <div style={{ color: '#333', fontSize: 14, marginTop: 4, lineHeight: 1.3, wordBreak: 'break-word' }}>
              {address}
            </div>
            <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>
              {record.equipmentType?.name || '—'}
            </div>
          </div>
          <Tag color={statusColor} style={{ margin: 0, flexShrink: 0 }}>{statusLabel}</Tag>
        </div>
        {getActionButtons(record, true) && (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
            {getActionButtons(record, true)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`page-container${isMobile ? ' page-with-bottom-nav' : ''}`} style={!isMobile ? { maxWidth: 1400 } : undefined}>
      {isMobile && (
        <MobileHeader
          title="Мои заявки"
          showBack
          onBack={() => navigate('/')}
        />
      )}

      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="page-title" style={{ margin: 0, fontSize: 16 }}>Мои заявки</div>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Назад</Button>
            <NotificationBell />
            <Button icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/login'); }}>Выход</Button>
          </Space>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={TAB_OPTIONS.map(t => ({
            value: t.value,
            label: t.label,
          }))}
          value={activeTab}
          onChange={(v) => setActiveTab(v as TabKey)}
          block
        />
      </div>

      <Card>
        {filtered.length === 0 && !loading ? (
          <Empty description={activeTab === 'all' ? 'Нет назначенных заявок' : 'Нет заявок в этой категории'} />
        ) : isMobile ? (
          <List
            dataSource={filtered}
            loading={loading}
            renderItem={(r: any) => <>{renderMobileCard(r)}</>}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20 }}
          />
        )}
      </Card>

      <Modal
        title="Отказ от заявки"
        open={declineModal.visible}
        onOk={handleDecline}
        onCancel={() => { setDeclineModal({ visible: false }); setDeclineReason(''); }}
        okText="Отказаться"
        okButtonProps={{ danger: true }}
        cancelText="Отмена"
      >
        <p>Укажите причину отказа:</p>
        <Input.TextArea
          rows={4}
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder="Причина отказа..."
        />
      </Modal>
    </div>
  );
}
