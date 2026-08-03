import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Tag, Space, Input, App } from 'antd';
import { PlusOutlined, LogoutOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { MtrVisit, MTR_VISIT_STATUS_LABELS } from '../../../../shared/types/index';
import { useIsMobile } from '../../hooks/useIsMobile';
import MobileHeader from '../../components/MobileHeader';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  in_progress: 'processing',
  completed: 'success',
  sent: 'blue',
  rejected: 'error',
  accepted: 'green',
};

export default function MtrVisitListPage() {
  const [visits, setVisits] = useState<MtrVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { message, modal } = App.useApp();
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    try {
      const params: any = { page: currentPage, pageSize };
      if (selectedStatus) params.status = selectedStatus;
      if (searchQuery) params.search = searchQuery;
      const res = await api.mtr.getVisits(params);
      setVisits(res.data || []);
      setTotal(res.total || 0);
    } catch {
      message.error('Ошибка загрузки визитов');
    }
    setLoading(false);
  }, [selectedStatus, currentPage, searchQuery, message]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [selectedStatus, searchQuery]);

  // Debounce для поиска
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleDelete = (e: React.MouseEvent, visitId: string) => {
    e.stopPropagation();
    modal.confirm({
      title: 'Удалить визит?',
      content: 'Визит будет скрыт из списка.',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.mtr.deleteVisit(visitId);
          message.success('Визит удалён');
          load();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const statusFilters = [
    { key: '', label: 'Все' },
    { key: 'draft', label: 'Черновики' },
    { key: 'in_progress', label: 'В работе' },
    { key: 'completed', label: 'Завершённые' },
    { key: 'sent', label: 'Отправленные' },
    { key: 'rejected', label: 'Отклонённые' },
    { key: 'accepted', label: 'Принятые' },
  ];

  const columns = [
    {
      title: '№ заявки',
      dataIndex: 'requestNumber',
      key: 'requestNumber',
      width: 150,
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
      width: 100,
      render: (_: any, record: MtrVisit) => (
        <Space>
          {(record.status === 'draft' || record.status === 'in_progress') && (
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={(e) => handleDelete(e, record.id)}
            />
          )}
        </Space>
      ),
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/mtr/visits/new')}>
              Новый визит
            </Button>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>Выход</Button>
          </Space>
        </div>
      )}

      {/* Фильтры статусов */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                onClick={() => navigate(`/mtr/visits/${visit.id}`)}
                style={{
                  padding: 12,
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{visit.requestNumber}</div>
                  <Tag color={STATUS_COLORS[visit.status] || 'default'}>
                    {MTR_VISIT_STATUS_LABELS[visit.status as keyof typeof MTR_VISIT_STATUS_LABELS] || visit.status}
                  </Tag>
                </div>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                  {visit.address?.fullAddress || '—'}
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  {dayjs(visit.dateStart).format('DD.MM.YYYY')}
                </div>
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
          onRow={(record) => ({
            onClick: () => navigate(`/mtr/visits/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      {/* Кнопка "Новый визит" на мобильном */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 100 }}>
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => navigate('/mtr/visits/new')}
            style={{ width: 56, height: 56, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          />
        </div>
      )}
    </div>
  );
}
