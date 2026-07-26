import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Tag, Space, Card, Modal, Input, App, Empty } from 'antd';
import { LogoutOutlined, CheckOutlined, CloseOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { VISIT_STATUS_LABELS } from '../../../shared/types/index';
import NotificationBell from '../components/NotificationBell';
import MobileHeader from '../components/MobileHeader';
import { useIsMobile } from '../hooks/useIsMobile';

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [declineModal, setDeclineModal] = useState<{ visible: boolean; requestId?: string }>({ visible: false });
  const [declineReason, setDeclineReason] = useState('');
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { message, modal } = App.useApp();
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

  const columns: ColumnsType<any> = [
    {
      title: '№ заявки',
      dataIndex: 'externalRequestId',
      key: 'externalRequestId',
      width: 150,
    },
    {
      title: 'Вид оборудования',
      key: 'equipment',
      width: 200,
      render: (_: any, record: any) => record.equipmentType?.name || '-',
    },
    {
      title: 'Код объекта',
      dataIndex: 'objectCode',
      key: 'objectCode',
      width: 120,
    },
    {
      title: 'Адрес',
      key: 'address',
      width: 300,
      render: (_: any, record: any) => record.matchedAddress?.fullAddress || record.addressRaw || '-',
    },
    {
      title: 'Статус визита',
      key: 'visitStatus',
      width: 150,
      render: (_: any, record: any) => {
        if (!record.visit) return '-';
        const statusLabel = VISIT_STATUS_LABELS[record.visit.status as keyof typeof VISIT_STATUS_LABELS] || record.visit.status;
        return <Tag>{statusLabel}</Tag>;
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 250,
      fixed: 'right',
      render: (_: any, record: any) => {
        if (!record.visit) return null;
        
        const canStart = ['planned', 'awaiting_assignment'].includes(record.visit.status);
        const canDecline = record.visit.status !== 'completed' && record.visit.status !== 'sent';

        return (
          <Space>
            {canStart && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => navigate(`/visit/${record.visit.id}`)}
              >
                Начать визит
              </Button>
            )}
            {canDecline && (
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => setDeclineModal({ visible: true, requestId: record.id })}
              >
                Отказаться
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-container">
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
            <NotificationBell />
            <Button icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/login'); }}>Выход</Button>
          </Space>
        </div>
      )}

      <Card>
        {requests.length === 0 && !loading ? (
          <Empty description="Нет назначенных заявок" />
        ) : (
          <Table
            columns={columns}
            dataSource={requests}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20 }}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      {/* Модальное окно отказа */}
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
