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

// Статусы исполнения для фильтрации по вкладкам
const NEW_EXECUTION_STATUSES = ['not_assigned', 'assigned'];
const ACTIVE_EXECUTION_STATUSES = ['in_progress'];
const DONE_EXECUTION_STATUSES = ['completed'];

function filterByTab(requests: any[], tab: TabKey) {
  if (tab === 'all') return requests;
  const statuses = tab === 'new' ? NEW_EXECUTION_STATUSES : tab === 'active' ? ACTIVE_EXECUTION_STATUSES : DONE_EXECUTION_STATUSES;
  return requests.filter(r => {
    const execStatus = r.executionStatus || 'not_assigned';
    return statuses.includes(execStatus);
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
    const execStatus = record.executionStatus || 'not_assigned';

    if (NEW_EXECUTION_STATUSES.includes(execStatus)) {
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

    if (ACTIVE_EXECUTION_STATUSES.includes(execStatus)) {
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
        const isISZHObject = record.equipmentType?.code === 'iszh_object';
        
        // Для ИСЖ объекта — агрегированный статус из всех связанных визитов
        if (isISZHObject && record.visitRequests?.length > 0) {
          const visits = record.visitRequests.map((vr: any) => vr.visit).filter(Boolean);
          const engineers = new Set<string>();
          visits.forEach((v: any) => {
            v.visitEngineers?.forEach((ve: any) => {
              if (ve.engineer?.fullName) engineers.add(ve.engineer.fullName);
            });
          });
          
          // Определяем агрегированный статус
          const statuses = visits.map((v: any) => v.status);
          const completedStatuses = ['completed', 'sent', 'corrected_by_tm'];
          const allCompleted = statuses.every((s: string) => completedStatuses.includes(s));
          const hasInProgress = statuses.includes('in_progress');
          
          let statusKey = 'awaiting_assignment';
          if (allCompleted) statusKey = 'completed';
          else if (hasInProgress) statusKey = 'in_progress';
          else if (statuses.some((s: string) => ['planned', 'not_started'].includes(s))) statusKey = 'planned';
          
          const label = VISIT_STATUS_LABELS[statusKey as keyof typeof VISIT_STATUS_LABELS] || statusKey;
          const engineerList = Array.from(engineers).join(', ') || 'Инженер не назначен';
          
          return (
            <div>
              <Tag color={STATUS_COLORS[statusKey] || 'default'}>{label}</Tag>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{engineerList}</div>
            </div>
          );
        }
        
        // Для обычных заявок — один визит
        if (!record.visit) return <Tag>Без визита</Tag>;
        const label = VISIT_STATUS_LABELS[record.visit.status as keyof typeof VISIT_STATUS_LABELS] || record.visit.status;
        const engineers = record.visit.visitEngineers?.map((ve: any) => ve.engineer?.fullName).filter(Boolean).join(', ');
        return (
          <div>
            <Tag color={STATUS_COLORS[record.visit.status] || 'default'}>{label}</Tag>
            {engineers && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{engineers}</div>}
          </div>
        );
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
    const isISZHObject = record.equipmentType?.code === 'iszh_object';
    let visitStatus: string | undefined;
    let engineerList = '';
    
    // Для ИСЖ объекта — агрегированный статус
    if (isISZHObject && record.visitRequests?.length > 0) {
      const visits = record.visitRequests.map((vr: any) => vr.visit).filter(Boolean);
      const engineers = new Set<string>();
      visits.forEach((v: any) => {
        v.visitEngineers?.forEach((ve: any) => {
          if (ve.engineer?.fullName) engineers.add(ve.engineer.fullName);
        });
      });
      engineerList = Array.from(engineers).join(', ');
      
      const statuses = visits.map((v: any) => v.status);
      const completedStatuses = ['completed', 'sent', 'corrected_by_tm'];
      const allCompleted = statuses.every((s: string) => completedStatuses.includes(s));
      const hasInProgress = statuses.includes('in_progress');
      
      if (allCompleted) visitStatus = 'completed';
      else if (hasInProgress) visitStatus = 'in_progress';
      else if (statuses.some((s: string) => ['planned', 'not_started'].includes(s))) visitStatus = 'planned';
      else visitStatus = 'awaiting_assignment';
    } else {
      visitStatus = record.visit?.status;
      engineerList = record.visit?.visitEngineers?.map((ve: any) => ve.engineer?.fullName).filter(Boolean).join(', ') || '';
    }
    
    const statusLabel = visitStatus
      ? (VISIT_STATUS_LABELS[visitStatus as keyof typeof VISIT_STATUS_LABELS] || visitStatus)
      : 'Без визита';
    const statusColor = STATUS_COLORS[visitStatus || ''] || 'default';
    const statusIcon = STATUS_ICONS[visitStatus || ''] || null;
    const address = record.matchedAddress?.fullAddress || record.addressRaw || '—';
    
    // Для навигации — используем первый связанный визит
    const primaryVisitId = isISZHObject 
      ? record.visitRequests?.[0]?.visit?.id 
      : record.visit?.id;

    return (
      <div
        className="request-card"
        onClick={() => primaryVisitId && navigate(`/visit/${primaryVisitId}`)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              {statusIcon && (
                <span style={{ marginRight: 2, display: 'inline-flex', color: statusColor === 'processing' ? '#0F766E' : statusColor === 'success' ? '#52c41a' : statusColor === 'cyan' ? '#13c2c2' : statusColor === 'orange' ? '#fa8c16' : '#888' }}>
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
            {engineerList && (
              <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                {engineerList}
              </div>
            )}
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
