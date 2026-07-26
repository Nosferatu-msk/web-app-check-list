import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, List, Tag, Empty, Spin, Space, Select, Card, Row, Col, Statistic, Modal, App, Switch, Dropdown } from 'antd';
import { PlusOutlined, LogoutOutlined, SettingOutlined, SwapOutlined, DeleteOutlined, BarChartOutlined, FormOutlined, UserOutlined, MoreOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined, SendOutlined, EditOutlined, MinusCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { VISIT_STATUS_LABELS, ROLE_LABELS } from '../../../shared/types/index';
import NotificationBell from '../components/NotificationBell';
import { useIsMobile } from '../hooks/useIsMobile';
import MobileHeader from '../components/MobileHeader';

const STATUS_COLORS: Record<string, string> = {
  planned: 'cyan',
  not_started: 'default',
  in_progress: 'processing',
  completed: 'success',
  sent: 'blue',
  sent_by_engineer: 'blue',
  sent_by_tm: 'geekblue',
  corrected_by_tm: 'purple',
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
};

const SPEC_LABELS: { key: string; label: string; className: string }[] = [
  { key: 'specializationVik', label: 'ВиК', className: 'spec-badge-vik' },
  { key: 'specializationIszh', label: 'ИСЖ', className: 'spec-badge-iszh' },
  { key: 'specializationGpm', label: 'ГПМ', className: 'spec-badge-gpm' },
  { key: 'specializationDgu', label: 'ДГУ', className: 'spec-badge-dgu' },
  { key: 'specializationIbp', label: 'ИБП', className: 'spec-badge-ibp' },
];

function getSpecBadges(userSpecs: Record<string, boolean | undefined> | undefined) {
  if (!userSpecs) return null;
  const badges = SPEC_LABELS.filter(s => userSpecs[s.key]);
  if (badges.length === 0) return null;
  return (
    <span style={{ marginLeft: 4, display: 'inline-flex', gap: 2, flexWrap: 'wrap' }}>
      {badges.map(s => (
        <span key={s.key} className={`spec-badge ${s.className}`} style={{ padding: '0 4px', borderRadius: 4, fontSize: 11, fontWeight: 500, lineHeight: '18px', display: 'inline-block' }}>
          {s.label}
        </span>
      ))}
    </span>
  );
}

export default function VisitListPage() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState<string>('');
  const [reassignModal, setReassignModal] = useState<{ visible: boolean; visitId?: string }>({ visible: false });
  const [reassignTarget, setReassignTarget] = useState<string>('');
  const [showDeleted, setShowDeleted] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { message, modal } = App.useApp();
  const isMobile = useIsMobile();

  const isTm = user?.role === 'tm';
  const isAdmin = user?.role === 'admin';
  const isManager = isTm || isAdmin;

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedEngineer) params.user_id = selectedEngineer;
      if (showDeleted) params.include_deleted = 'true';
      const res = await api.getVisits(params);
      setVisits(res.data || []);
      if (isManager) {
        const users = await api.getEngineers();
        setEngineers((users || []).filter((u: any) => u.isActive !== false));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedEngineer, isManager, showDeleted]);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleDelete = (e: React.MouseEvent, visitId: string) => {
    e.stopPropagation();
    modal.confirm({
      title: 'Удалить визит?',
      content: 'Визит будет скрыт из списка. Данные сохранятся для аудита.',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        await api.deleteVisit(visitId);
        message.success('Визит удалён');
        load();
      },
    });
  };

  const handleReassign = async () => {
    if (!reassignModal.visitId || !reassignTarget) return;
    try {
      await api.reassignVisit(reassignModal.visitId, reassignTarget);
      message.success('Визит переназначен');
      setReassignModal({ visible: false });
      setReassignTarget('');
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const stats = {
    total: visits.length,
    planned: visits.filter((v: any) => v.status === 'planned').length,
    inProgress: visits.filter((v: any) => ['not_started', 'in_progress'].includes(v.status)).length,
    completed: visits.filter((v: any) => ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'].includes(v.status)).length,
  };

  const pageTitle = isAdmin ? 'Все визиты' : isTm ? 'Визиты инженеров' : 'Мои визиты';
  const roleLabel = ROLE_LABELS[user?.role || 'engineer'];

  return (
    <div className={`page-container${user?.role === 'engineer' && isMobile ? ' page-with-bottom-nav' : ''}`}>
      {/* Мобильный заголовок */}
      {isMobile && (
        <MobileHeader
          title={pageTitle}
          actions={
            <Space size={4}>
              {!isManager && (
                <Button type="text" size="small" icon={<FormOutlined />} onClick={() => navigate('/my-requests')} aria-label="Мои заявки" />
              )}
              {isManager && (
                <>
                  <Button type="text" size="small" icon={<FormOutlined />} onClick={() => navigate('/requests')} aria-label="Заявки" />
                  <Button type="text" size="small" icon={<BarChartOutlined />} onClick={() => navigate('/reports/summary')} aria-label="Сводные отчёты" />
                </>
              )}
              {isAdmin && (
                <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => navigate('/admin')} aria-label="Админ" />
              )}
              <Button type="text" size="small" icon={<LogoutOutlined />} onClick={handleLogout} aria-label="Выход" />
            </Space>
          }
          showTorch={user?.role === 'engineer'}
        />
      )}

      {/* Десктопный заголовок — скрыт на мобильных */}
      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/profile')}>
            <UserOutlined style={{ fontSize: 24, color: '#1677ff' }} />
            <div>
              <div className="page-title" style={{ margin: 0, fontSize: 16 }}>{pageTitle}</div>
              <div style={{ color: '#666', fontSize: 14 }}>{user?.fullName} ({roleLabel})</div>
            </div>
          </div>
          <Space>
            <NotificationBell />
            {!isManager && (
              <Button icon={<FormOutlined />} onClick={() => navigate('/my-requests')}>Мои заявки</Button>
            )}
            {isManager && (
              <>
                <Button icon={<FormOutlined />} onClick={() => navigate('/requests')}>Заявки</Button>
                <Button icon={<BarChartOutlined />} onClick={() => navigate('/reports/summary')}>Сводные отчёты</Button>
              </>
            )}
            {isAdmin && (
              <Button icon={<SettingOutlined />} onClick={() => navigate('/admin')}>Админ</Button>
            )}
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>Выход</Button>
          </Space>
        </div>
      )}

      {/* Статистика — responsive: 2 в ряд на мобильных, 4 в ряд на десктопе */}
      {isManager && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={12} md={6}><Card size="small"><Statistic title="Всего" value={stats.total} /></Card></Col>
          <Col xs={12} sm={12} md={6}><Card size="small"><Statistic title="Запланировано" value={stats.planned} valueStyle={{ color: '#13c2c2' }} /></Card></Col>
          <Col xs={12} sm={12} md={6}><Card size="small"><Statistic title="В работе" value={stats.inProgress} valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col xs={12} sm={12} md={6}><Card size="small"><Statistic title="Завершено" value={stats.completed} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        </Row>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {(user?.role === 'engineer' || user?.role === 'tm') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/visit/new')} block size="middle">
            Новый визит
          </Button>
        )}
        {isManager && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {engineers.length > 0 && (
              <Select
                allowClear
                placeholder="Фильтр по инженеру"
                style={{ flex: 1, minWidth: 0 }}
                value={selectedEngineer || undefined}
                onChange={(v) => setSelectedEngineer(v || '')}
                options={engineers.map((e: any) => ({ value: e.id, label: e.fullName }))}
              />
            )}
            <Switch
              checked={showDeleted}
              onChange={setShowDeleted}
              checkedChildren="Удалённые"
              unCheckedChildren="Активные"
              style={{ flexShrink: 0 }}
            />
          </div>
        )}
      </div>

      {loading ? <Spin /> : visits.length === 0 ? (
        <Empty description="Нет визитов" />
      ) : (
        <List
          dataSource={visits}
          renderItem={(v: any) => {
            const statusLabel = VISIT_STATUS_LABELS[v.status as keyof typeof VISIT_STATUS_LABELS] || v.status;
            const statusColor = STATUS_COLORS[v.status] || 'default';
            const statusIcon = STATUS_ICONS[v.status] || null;
            const isDeleted = v.isDeleted;
            const sentDate = v.status === 'sent_by_engineer' && v.sentByEngineerAt
              ? dayjs(v.sentByEngineerAt).format('DD.MM.YYYY HH:mm')
              : v.status === 'sent_by_tm' && v.sentByTmAt
                ? dayjs(v.sentByTmAt).format('DD.MM.YYYY HH:mm')
                : null;

            // Действия для overflow-меню (мобильные)
            const actionItems: any[] = [];
            if (isManager && !isDeleted && ['not_started', 'in_progress', 'planned'].includes(v.status)) {
              actionItems.push({
                key: 'reassign',
                icon: <SwapOutlined />,
                label: 'Переназначить',
                onClick: (info: any) => {
                  info?.domEvent?.stopPropagation();
                  setReassignModal({ visible: true, visitId: v.id });
                  setReassignTarget('');
                },
              });
            }
            if (!isDeleted) {
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
            }

            return (
              <div
                className="visit-card"
                onClick={() => navigate(`/visit/${v.id}`)}
                style={isDeleted ? { opacity: 0.6, background: '#f5f5f5' } : undefined}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      {statusIcon && (
                        <span aria-label={`Статус: ${statusLabel}`} style={{ marginRight: 2, display: 'inline-flex', color: STATUS_COLORS[v.status] === 'processing' ? '#1677ff' : STATUS_COLORS[v.status] === 'success' ? '#52c41a' : STATUS_COLORS[v.status] === 'cyan' ? '#13c2c2' : STATUS_COLORS[v.status] === 'blue' ? '#1677ff' : STATUS_COLORS[v.status] === 'geekblue' ? '#2f54eb' : STATUS_COLORS[v.status] === 'purple' ? '#722ed1' : '#888' }}>
                          {statusIcon}
                        </span>
                      )}
                      {v.address?.objectCode && <Tag color="blue" style={{ marginRight: 4 }}>{v.address.objectCode}</Tag>}
                      {v.importedRequests?.length > 0 && <Tag color="green" style={{ marginRight: 4 }}>{v.importedRequests[0].externalRequestId}</Tag>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.address?.fullAddress || 'Адрес'}</span>
                    </div>
                    <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                      {new Date(v.dateStart).toLocaleDateString('ru-RU')} в {v.timeStart}
                      {' · '}Задач: {v._count?.tasks || 0}
                      {v.user && v.user.id !== user?.id && (
                        <span> · {v.user.fullName}
                          {getSpecBadges(v.user)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Десктоп: обычные кнопки */}
                  {!isMobile && (
                    <Space>
                      <Tag color={statusColor}>{statusLabel}</Tag>
                      {sentDate && (
                        <span style={{ fontSize: 12, color: '#888' }}>📤 {sentDate}</span>
                      )}
                      {isDeleted && (
                        <Tag color="default">Удалён</Tag>
                      )}
                      {isDeleted && v.deletedBy && v.deletedAt && (
                        <span style={{ fontSize: 12, color: '#999' }}>
                          {v.deletedBy.fullName}, {dayjs(v.deletedAt).format('DD.MM.YYYY HH:mm')}
                        </span>
                      )}
                      {isManager && !isDeleted && ['not_started', 'in_progress', 'planned'].includes(v.status) && (
                        <Button size="small" icon={<SwapOutlined />} onClick={(e) => {
                          e.stopPropagation();
                          setReassignModal({ visible: true, visitId: v.id });
                          setReassignTarget('');
                        }} />
                      )}
                      {!isDeleted && (
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => handleDelete(e, v.id)} />
                      )}
                    </Space>
                  )}
                  {/* Мобильные: статус-бейдж + overflow-меню */}
                  {isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <Tag color={statusColor} style={{ margin: 0 }}>{statusLabel}</Tag>
                      {sentDate && (
                        <span style={{ fontSize: 11, color: '#888' }}>📤</span>
                      )}
                      {isDeleted && (
                        <Tag color="default" style={{ margin: 0, fontSize: 11 }}>Удалён</Tag>
                      )}
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
      )}

      <Modal
        title="Переназначить визит"
        open={reassignModal.visible}
        onOk={handleReassign}
        onCancel={() => setReassignModal({ visible: false })}
        okText="Переназначить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !reassignTarget }}
      >
        <Select
          placeholder="Выберите инженера"
          style={{ width: '100%' }}
          value={reassignTarget || undefined}
          onChange={setReassignTarget}
          options={engineers.map((e: any) => ({ value: e.id, label: e.fullName }))}
        />
      </Modal>
    </div>
  );
}
