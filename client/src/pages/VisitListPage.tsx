import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, List, Tag, Empty, Spin, Space, Select, Card, Row, Col, Statistic, Modal, App } from 'antd';
import { PlusOutlined, LogoutOutlined, SettingOutlined, SwapOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { VISIT_STATUS_LABELS, ROLE_LABELS } from '../../../shared/types/index';

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

export default function VisitListPage() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState<string>('');
  const [reassignModal, setReassignModal] = useState<{ visible: boolean; visitId?: string }>({ visible: false });
  const [reassignTarget, setReassignTarget] = useState<string>('');
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { message, modal } = App.useApp();

  const isTm = user?.role === 'tm';
  const isAdmin = user?.role === 'admin';
  const isManager = isTm || isAdmin;

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedEngineer) params.user_id = selectedEngineer;
      const res = await api.getVisits(params);
      setVisits(res.data || []);
      if (isManager) {
        const users = await api.adminGet('users');
        setEngineers((users || []).filter((u: any) => u.role === 'engineer' && u.isActive));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedEngineer, isManager]);

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
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="page-title">{pageTitle}</div>
          <div style={{ color: '#666', fontSize: 14 }}>{user?.fullName} ({roleLabel})</div>
        </div>
        <Space>
          {isAdmin && (
            <Button icon={<SettingOutlined />} onClick={() => navigate('/admin')}>Админ</Button>
          )}
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>Выход</Button>
        </Space>
      </div>

      {isManager && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card size="small"><Statistic title="Всего" value={stats.total} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Запланировано" value={stats.planned} valueStyle={{ color: '#13c2c2' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="В работе" value={stats.inProgress} valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Завершено" value={stats.completed} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        </Row>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(user?.role === 'engineer' || user?.role === 'tm') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/visit/new')} style={{ flex: 1 }} size="large">
            Новый визит
          </Button>
        )}
        {isManager && engineers.length > 0 && (
          <Select
            allowClear
            placeholder="Фильтр по инженеру"
            style={{ minWidth: 200 }}
            value={selectedEngineer || undefined}
            onChange={(v) => setSelectedEngineer(v || '')}
            options={engineers.map((e: any) => ({ value: e.id, label: e.fullName }))}
          />
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
            return (
              <div className="visit-card" onClick={() => navigate(`/visit/${v.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{v.address?.fullAddress || 'Адрес'}</div>
                    <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                      {new Date(v.dateStart).toLocaleDateString('ru-RU')} в {v.timeStart}
                      {' · '}Задач: {v._count?.tasks || 0}
                      {v.user && v.user.id !== user?.id && (
                        <span> · {v.user.fullName}</span>
                      )}
                    </div>
                  </div>
                  <Space>
                    <Tag color={statusColor}>{statusLabel}</Tag>
                    {isManager && !v.isDeleted && ['not_started', 'in_progress', 'planned'].includes(v.status) && (
                      <Button size="small" icon={<SwapOutlined />} onClick={(e) => {
                        e.stopPropagation();
                        setReassignModal({ visible: true, visitId: v.id });
                        setReassignTarget('');
                      }} />
                    )}
                    {!v.isDeleted && (
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => handleDelete(e, v.id)} />
                    )}
                  </Space>
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
