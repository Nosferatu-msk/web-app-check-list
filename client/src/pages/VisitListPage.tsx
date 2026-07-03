import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, List, Tag, Empty, Spin, Space } from 'antd';
import { PlusOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  in_progress: { color: 'processing', label: 'В работе' },
  completed: { color: 'success', label: 'Завершён' },
  sent: { color: 'blue', label: 'Отправлен' },
};

export default function VisitListPage() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const load = async () => {
    try {
      const res = await api.getVisits();
      setVisits(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="page-title">Мои визиты</div>
          <div style={{ color: '#666', fontSize: 14 }}>{user?.fullName} ({user?.role === 'admin' ? 'Администратор' : 'Инженер'})</div>
        </div>
        <Space>
          {user?.role === 'admin' && (
            <Button icon={<SettingOutlined />} onClick={() => navigate('/admin')}>Админ</Button>
          )}
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>Выход</Button>
        </Space>
      </div>

      <Button type="primary" icon={<PlusOutlined />} block size="large" onClick={() => navigate('/visit/new')} style={{ marginBottom: 16 }}>
        Новый визит
      </Button>

      {loading ? <Spin /> : visits.length === 0 ? (
        <Empty description="Нет визитов" />
      ) : (
        <List
          dataSource={visits}
          renderItem={(v: any) => {
            const st = STATUS_MAP[v.status] || STATUS_MAP.in_progress;
            return (
              <div className="visit-card" onClick={() => navigate(`/visit/${v.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{v.address?.fullAddress || 'Адрес'}</div>
                    <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                      {new Date(v.dateStart).toLocaleDateString('ru-RU')} в {v.timeStart} · Задач: {v._count?.tasks || 0}
                    </div>
                  </div>
                  <Tag color={st.color}>{st.label}</Tag>
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
