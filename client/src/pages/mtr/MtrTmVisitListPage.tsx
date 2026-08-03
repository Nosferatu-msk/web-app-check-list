import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Tag, Space, Input, App, Select, Modal, Typography } from 'antd';
import { LogoutOutlined, SearchOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { MtrVisit, MTR_VISIT_STATUS_LABELS } from '../../../../shared/types/index';
import { useIsMobile } from '../../hooks/useIsMobile';
import MobileHeader from '../../components/MobileHeader';

const { Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  in_progress: 'processing',
  completed: 'success',
  sent: 'blue',
  rejected: 'error',
  accepted: 'green',
};

export default function MtrTmVisitListPage() {
  const [visits, setVisits] = useState<MtrVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedEngineer, setSelectedEngineer] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; visitId?: string }>({ open: false });
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const pageSize = 20;
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { message, modal } = App.useApp();
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    try {
      const params: any = { page: currentPage, pageSize };
      if (selectedStatus) params.status = selectedStatus;
      if (selectedEngineer) params.engineer_id = selectedEngineer;
      if (searchQuery) params.search = searchQuery;
      const res = await api.mtr.getTmVisits(params);
      setVisits(res.data || []);
      setTotal(res.total || 0);
    } catch {
      message.error('Ошибка загрузки визитов');
    }
    setLoading(false);
  }, [selectedStatus, selectedEngineer, currentPage, searchQuery, message]);

  const loadEngineers = useCallback(async () => {
    try {
      const data = await api.mtr.getTmEngineers();
      setEngineers(data.map((d: any) => d.engineer).filter(Boolean));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadEngineers(); }, [loadEngineers]);
  useEffect(() => { setCurrentPage(1); }, [selectedStatus, selectedEngineer, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleAccept = (visitId: string) => {
    modal.confirm({
      title: 'Принять визит?',
      okText: 'Принять',
      cancelText: 'Отмена',
      onOk: async () => {
        setActionLoading(true);
        try {
          await api.mtr.acceptVisit(visitId);
          message.success('Визит принят');
          await load();
        } catch (err: any) {
          message.error(err.message);
        }
        setActionLoading(false);
      },
    });
  };

  const handleReject = async () => {
    if (!rejectModal.visitId || !rejectReason.trim()) {
      message.warning('Укажите причину отклонения');
      return;
    }
    setActionLoading(true);
    try {
      await api.mtr.rejectVisit(rejectModal.visitId, rejectReason.trim());
      message.success('Визит отклонён');
      setRejectModal({ open: false });
      setRejectReason('');
      await load();
    } catch (err: any) {
      message.error(err.message);
    }
    setActionLoading(false);
  };

  const statusFilters = [
    { key: '', label: 'Все' },
    { key: 'sent', label: 'На проверке' },
    { key: 'accepted', label: 'Принятые' },
    { key: 'rejected', label: 'Отклонённые' },
    { key: 'draft', label: 'Черновики' },
    { key: 'in_progress', label: 'В работе' },
  ];

  const columns = [
    {
      title: '№ заявки',
      dataIndex: 'requestNumber',
      key: 'requestNumber',
      width: 150,
    },
    {
      title: 'Инженер',
      key: 'engineer',
      width: 180,
      render: (_: any, record: MtrVisit) => record.engineer?.fullName || '—',
    },
    {
      title: 'Адрес',
      key: 'address',
      ellipsis: true,
      render: (_: any, record: MtrVisit) => record.address?.fullAddress || '—',
    },
    {
      title: 'Дата',
      dataIndex: 'dateStart',
      key: 'dateStart',
      width: 120,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>
          {MTR_VISIT_STATUS_LABELS[status as keyof typeof MTR_VISIT_STATUS_LABELS] || status}
        </Tag>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 160,
      render: (_: any, record: MtrVisit) => {
        if (record.status !== 'sent') return null;
        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={(e) => { e.stopPropagation(); handleAccept(record.id); }}
              loading={actionLoading}
            >
              Принять
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={(e) => { e.stopPropagation(); setRejectModal({ open: true, visitId: record.id }); }}
            >
              Отклонить
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-container" style={!isMobile ? { maxWidth: 1400, margin: '0 auto', padding: 16 } : undefined}>
      {isMobile && (
        <MobileHeader
          title="Визиты МТР"
          actions={
            <Space size={4}>
              <Button type="text" size="small" icon={<LogoutOutlined />} onClick={handleLogout} aria-label="Выход" />
            </Space>
          }
        />
      )}

      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>Визиты МТР</div>
            <div style={{ color: '#666', fontSize: 14 }}>{user?.fullName}</div>
          </div>
          <Space>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>Выход</Button>
          </Space>
        </div>
      )}

      {/* Фильтры статусов */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {statusFilters.map((f) => (
          <Button
            key={f.key}
            type={selectedStatus === f.key ? 'primary' : 'default'}
            size="small"
            onClick={() => setSelectedStatus(f.key)}
          >
            {f.label}
          </Button>
        ))}
        {engineers.length > 0 && (
          <Select
            placeholder="Инженер"
            allowClear
            style={{ width: 200 }}
            value={selectedEngineer || undefined}
            onChange={(v) => setSelectedEngineer(v || '')}
            options={engineers.map((e) => ({ value: e.id, label: e.fullName }))}
          />
        )}
      </div>

      {/* Поиск */}
      <Input
        placeholder="Поиск по адресу или номеру заявки..."
        prefix={<SearchOutlined />}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        allowClear
        style={{ marginBottom: 16, maxWidth: isMobile ? '100%' : 400 }}
      />

      {/* Таблица или список */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>Загрузка...</div>
          ) : visits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Нет визитов</div>
          ) : (
            visits.map((visit) => (
              <div
                key={visit.id}
                style={{
                  padding: 12,
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600 }}>{visit.requestNumber}</div>
                  <Tag color={STATUS_COLORS[visit.status] || 'default'}>
                    {MTR_VISIT_STATUS_LABELS[visit.status as keyof typeof MTR_VISIT_STATUS_LABELS] || visit.status}
                  </Tag>
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                  Инженер: {visit.engineer?.fullName || '—'}
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                  {visit.address?.fullAddress || '—'}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                  {dayjs(visit.dateStart).format('DD.MM.YYYY')}
                </div>
                {visit.status === 'sent' && (
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => handleAccept(visit.id)}
                      loading={actionLoading}
                    >
                      Принять
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => setRejectModal({ open: true, visitId: visit.id })}
                    >
                      Отклонить
                    </Button>
                  </Space>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <Table
          dataSource={visits}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            onChange: (page) => setCurrentPage(page),
            showSizeChanger: false,
            showTotal: (total) => `Всего: ${total}`,
          }}
        />
      )}

      {/* Модалка отклонения */}
      <Modal
        title="Отклонить визит"
        open={rejectModal.open}
        onCancel={() => { setRejectModal({ open: false }); setRejectReason(''); }}
        onOk={handleReject}
        okText="Отклонить"
        okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
        cancelText="Отмена"
        confirmLoading={actionLoading}
      >
        <div style={{ marginBottom: 8 }}>
          <Text>Укажите причину отклонения:</Text>
        </div>
        <Input.TextArea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
          placeholder="Причина отклонения..."
          autoFocus
        />
      </Modal>
    </div>
  );
}
