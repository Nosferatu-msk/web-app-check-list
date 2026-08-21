import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, List, Tag, Empty, Spin, Space, Select, Input, App, Badge, Dropdown, Pagination } from 'antd';
import {
  PlusOutlined, LogoutOutlined, DeleteOutlined, UserOutlined,
  MoreOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined,
  SendOutlined, EditOutlined, MinusCircleOutlined, SearchOutlined,
  CloseCircleOutlined, CloudOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, isOffline } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { MtrVisit, MTR_VISIT_STATUS_LABELS } from '../../../../shared/types/index';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import MobileHeader from '../../components/MobileHeader';
import { db } from '../../db/index';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  in_progress: 'processing',
  completed: 'success',
  sent: 'blue',
  rejected: 'error',
  accepted: 'green',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <ClockCircleOutlined />,
  in_progress: <SyncOutlined spin />,
  completed: <CheckCircleOutlined />,
  sent: <SendOutlined />,
  rejected: <CloseCircleOutlined />,
  accepted: <CheckCircleOutlined />,
};

export default function MtrVisitListPage() {
  const [visits, setVisits] = useState<MtrVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { message, modal } = App.useApp();
  const isMobile = useIsMobile();
  const { isOnline, pendingCount } = useOnlineStatus();

  const loadFromDexie = useCallback(async () => {
    const localVisits = await db.mtrVisits.toArray();
    localVisits.sort((a, b) => (b.dateStart || '').localeCompare(a.dateStart || ''));
    return localVisits;
  }, []);

  const load = useCallback(async () => {
    try {
      if (isOffline()) {
        const localVisits = await loadFromDexie();
        let filtered = localVisits as any[];
        if (selectedStatuses.length > 0) {
          filtered = filtered.filter((v) => selectedStatuses.includes(v.status));
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter((v) =>
            v.requestNumber?.toLowerCase().includes(q)
          );
        }
        setVisits(filtered.map((v) => ({
          id: v.serverId || v.id,
          _localId: v.id,
          requestNumber: v.requestNumber,
          dateStart: v.dateStart,
          timeStart: v.timeStart,
          status: v.status,
          isDraft: v.isDraft,
          dirty: v.dirty,
          address: { fullAddress: v.addressId },
        })) as any);
        setTotal(filtered.length);
      } else {
        const params: any = { page: currentPage, pageSize };
        if (selectedStatuses.length > 0) params.status = selectedStatuses.join(',');
        if (searchQuery) params.search = searchQuery;
        const res = await api.mtr.getVisits(params);
        setVisits(res.data || []);
        setTotal(res.total || 0);
      }
    } catch {
      message.error('Ошибка загрузки визитов');
    }
    setLoading(false);
  }, [selectedStatuses, currentPage, searchQuery, message, loadFromDexie]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [selectedStatuses, searchQuery]);

  // Debounce для поиска
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Автообновление при возврате на вкладку
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [load]);

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
          await api.mtrDeleteVisitOffline(visitId);
          message.success('Визит удалён');
          load();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const statusOptions = Object.entries(MTR_VISIT_STATUS_LABELS).map(([key, label]) => ({ value: key, label }));

  return (
    <div className={`page-container${isMobile ? ' page-with-bottom-nav' : ''}`} style={!isMobile ? { maxWidth: 1400 } : undefined}>
      {/* Мобильный заголовок */}
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

      {/* Офлайн-индикатор */}
      {!isOnline && (
        <div style={{ padding: '8px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CloudOutlined style={{ color: '#fa8c16' }} />
          <span>Офлайн-режим</span>
          {pendingCount > 0 && <Badge count={pendingCount} style={{ backgroundColor: '#fa8c16' }} />}
        </div>
      )}

      {/* Десктопный заголовок */}
      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/profile')}>
            <UserOutlined style={{ fontSize: 24, color: '#0F766E' }} />
            <div>
              <div className="page-title" style={{ margin: 0, fontSize: 16 }}>Визиты МТР</div>
              <div style={{ color: '#666', fontSize: 14 }}>{user?.fullName}</div>
            </div>
          </div>
          <Space>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>Выход</Button>
          </Space>
        </div>
      )}

      {/* Фильтры и кнопки */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/mtr/visits/new')} block size="middle">
          Новый визит
        </Button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Поиск по адресу или номеру заявки"
            allowClear
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="Статусы"
            maxTagCount="responsive"
            value={selectedStatuses}
            onChange={(v) => setSelectedStatuses(v || [])}
            style={{ minWidth: 160, flex: 1 }}
            options={statusOptions}
          />
        </div>
      </div>

      {/* Список визитов */}
      {loading ? <Spin /> : visits.length === 0 ? (
        <Empty description="Нет визитов" />
      ) : (
        <>
          <List
            dataSource={visits}
            renderItem={(v: any) => {
              const statusLabel = MTR_VISIT_STATUS_LABELS[v.status as keyof typeof MTR_VISIT_STATUS_LABELS] || v.status;
              const statusColor = STATUS_COLORS[v.status] || 'default';
              const statusIcon = STATUS_ICONS[v.status] || null;

              // Действия для overflow-меню (мобильные)
              const actionItems: any[] = [];
              actionItems.push({
                key: 'delete',
                icon: <DeleteOutlined />,
                label: 'Удалить',
                danger: true,
                onClick: (info: any) => {
                  info?.domEvent?.stopPropagation();
                  handleDelete(info.domEvent, v.id);
                },
              });

              return (
                <div
                  className="visit-card"
                  onClick={() => navigate(`/mtr/visits/${v.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                        {statusIcon && (
                          <span aria-label={`Статус: ${statusLabel}`} style={{ marginRight: 2, display: 'inline-flex', color: STATUS_COLORS[v.status] === 'processing' ? '#0F766E' : STATUS_COLORS[v.status] === 'success' || STATUS_COLORS[v.status] === 'green' ? '#52c41a' : STATUS_COLORS[v.status] === 'blue' ? '#0F766E' : STATUS_COLORS[v.status] === 'error' ? '#ff4d4f' : '#888' }}>
                            {statusIcon}
                          </span>
                        )}
                        <Tag color="blue" style={{ marginRight: 4 }}>{v.requestNumber}</Tag>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.address?.fullAddress || 'Адрес'}</span>
                      </div>
                      <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                        {v.dateStart ? dayjs(v.dateStart).format('DD.MM.YYYY') : ''}
                        {v.timeStart && ` в ${v.timeStart}`}
                        {(v as any)?.dirty && <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>Не синхронизировано</Tag>}
                      </div>
                    </div>
                    {/* Десктоп: обычные кнопки */}
                    {!isMobile && (
                      <Space>
                        <Tag color={statusColor}>{statusLabel}</Tag>
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => handleDelete(e, v.id)} />
                      </Space>
                    )}
                    {/* Мобильные: статус-бейдж + overflow-меню */}
                    {isMobile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <Tag color={statusColor} style={{ margin: 0 }}>{statusLabel}</Tag>
                        {actionItems.length > 0 && (
                          <Dropdown menu={{ items: actionItems }} trigger={['click']}>
                            <Button
                              type="text"
                              size="small"
                              icon={<MoreOutlined style={{ fontSize: 18 }} />}
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Действия"
                              style={{ minWidth: 32, minHeight: 32 }}
                            />
                          </Dropdown>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />
          {total > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <Pagination
                current={currentPage}
                total={total}
                pageSize={pageSize}
                onChange={(p) => setCurrentPage(p)}
                showSizeChanger={false}
                showTotal={(t, range) => `${range[0]}–${range[1]} из ${t}`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
