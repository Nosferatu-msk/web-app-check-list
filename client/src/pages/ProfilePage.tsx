import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Checkbox, List, Tag, Space, Spin, Typography, Divider,
  Select, App, Statistic, Row, Col, Badge, Tooltip, Popconfirm, Empty,
} from 'antd';
import {
  ArrowLeftOutlined, StarOutlined, StarFilled, DeleteOutlined,
  PlusOutlined, UserOutlined, MailOutlined, LockOutlined,
  SettingOutlined, TeamOutlined, WarningOutlined, EnvironmentOutlined,
  ToolOutlined, FileTextOutlined, ImportOutlined, AuditOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { ROLE_LABELS } from '../../../shared/types/index';

const { Title, Text } = Typography;

// ─── Network Status Hook ──────────────────────────────────────
function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return isOnline;
}

// ─── Engineer Profile ─────────────────────────────────────────
function EngineerProfile() {
  const { user, updateSpecialization } = useAuthStore();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const isOnline = useNetworkStatus();

  // Specialization
  const [vik, setVik] = useState(user?.specializationVik ?? false);
  const [iszh, setIszh] = useState(user?.specializationIszh ?? false);
  const [specLoading, setSpecLoading] = useState(false);

  // Favorites
  const [favorites, setFavorites] = useState<any[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  // Stats
  const [stats, setStats] = useState<{ visitsThisMonth: number; issuesFound: number }>({ visitsThisMonth: 0, issuesFound: 0 });

  const loadFavorites = useCallback(async () => {
    setFavLoading(true);
    try {
      const data = await api.getFavorites();
      setFavorites(Array.isArray(data) ? data : (data as any).data || []);
    } catch { /* ignore */ }
    setFavLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getProfileStats();
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadFavorites(); loadStats(); }, [loadFavorites, loadStats]);

  const handleSpecChange = async () => {
    setSpecLoading(true);
    try {
      await updateSpecialization({ specializationVik: vik, specializationIszh: iszh });
      message.success('Специализация обновлена');
    } catch (err: any) {
      message.error(err.message || 'Ошибка сохранения');
    } finally {
      setSpecLoading(false);
    }
  };

  const handleSearch = async (value: string) => {
    setSearchQuery(value);
    if (value.length < 2) { setSearchResults([]); return; }
    try {
      const results = await api.searchAddresses(value);
      setSearchResults(results.slice(0, 20));
    } catch { /* ignore */ }
  };

  const handleAddFavorite = async () => {
    if (!selectedAddress) return;
    if (favorites.length >= 20) {
      message.warning('Максимум 20 избранных объектов');
      return;
    }
    try {
      await api.addFavorite(selectedAddress);
      message.success('Добавлено в избранное');
      setSelectedAddress('');
      setSearchQuery('');
      setSearchResults([]);
      loadFavorites();
    } catch (err: any) {
      message.error(err.message || 'Ошибка добавления');
    }
  };

  const handleRemoveFavorite = async (objectCode: string) => {
    try {
      await api.removeFavorite(objectCode);
      message.success('Удалено из избранного');
      loadFavorites();
    } catch (err: any) {
      message.error(err.message || 'Ошибка удаления');
    }
  };

  const hasMatchingEquipment = (fav: any): boolean => {
    if (!fav.objectEquipment || fav.objectEquipment.length === 0) return false;
    return fav.objectEquipment.some((eq: any) => {
      const et = eq.equipmentType;
      if (!et) return false;
      if (vik && ['vent', 'vrv_vn', 'vrv_nar', 'mssvn', 'mssnar', 'splitvn', 'splitnar'].includes(et.code)) return true;
      if (iszh && ['rsch', 'schetchik_gvs', 'schetchik_hvs', 'schetchik_electroshc', 'seti_vodosnab', 'teplovye_seti'].includes(et.code)) return true;
      return false;
    });
  };

  return (
    <div>
      {/* Network status */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Badge status={isOnline ? 'success' : 'error'} />
        <Text type={isOnline ? 'success' : 'danger'}>{isOnline ? 'В сети' : 'Офлайн'}</Text>
      </div>

      {/* Specialization */}
      <Card title="Специализация" size="small" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Checkbox checked={vik} onChange={(e) => setVik(e.target.checked)}>
            <Text strong>ВиК</Text> <Text type="secondary">(Вентиляция и Кондиционирование)</Text>
          </Checkbox>
        </div>
        <div style={{ marginBottom: 12 }}>
          <Checkbox checked={iszh} onChange={(e) => setIszh(e.target.checked)}>
            <Text strong>ИСЖ</Text> <Text type="secondary">(Инженерные Сети и Электрика)</Text>
          </Checkbox>
        </div>
        <Button size="small" loading={specLoading} onClick={handleSpecChange}>
          Сохранить
        </Button>
      </Card>

      {/* Quick stats */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small">
            <Statistic title="Визитов за месяц" value={stats.visitsThisMonth} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <Statistic title="Замечаний" value={stats.issuesFound} valueStyle={{ color: stats.issuesFound > 0 ? '#faad14' : undefined }} />
          </Card>
        </Col>
      </Row>

      {/* Favorites */}
      <Card
        title={<span><StarFilled style={{ color: '#faad14' }} /> Избранные объекты</span>}
        size="small"
        style={{ marginBottom: 16 }}
        extra={<Text type="secondary">{favorites.length}/20</Text>}
      >
        {/* Add favorite */}
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <Select
            showSearch
            filterOption={false}
            placeholder="Поиск адреса..."
            style={{ flex: 1 }}
            value={selectedAddress || undefined}
            onChange={setSelectedAddress}
            onSearch={handleSearch}
            searchValue={searchQuery}
            notFoundContent={searchQuery.length >= 2 ? 'Ничего не найдено' : 'Введите 2+ символа'}
            options={searchResults.map((a: any) => ({
              value: a.id || a.objectCode || a.fullAddress,
              label: a.fullAddress || a.full_address,
            }))}
          />
          <Button icon={<PlusOutlined />} onClick={handleAddFavorite} disabled={!selectedAddress || favorites.length >= 20} />
        </div>

        {favLoading ? <Spin /> : favorites.length === 0 ? (
          <Empty description="Нет избранных объектов" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={favorites}
            renderItem={(fav: any) => {
              const canCreate = hasMatchingEquipment(fav);
              return (
                <List.Item
                  actions={[
                    <Tooltip title="Создать визит" key="create">
                      <Button
                        type="link"
                        size="small"
                        disabled={!canCreate}
                        onClick={() => navigate(`/visit/new?addressId=${fav.objectCode || fav.addressId}`)}
                      >
                        <PlusOutlined />
                      </Button>
                    </Tooltip>,
                    <Popconfirm title="Удалить из избранного?" onConfirm={() => handleRemoveFavorite(fav.objectCode)} key="del">
                      <Button type="link" size="small" danger><StarFilled /></Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span>
                        {fav.fullAddress || fav.address?.fullAddress || fav.objectCode}
                        {!canCreate && fav.objectEquipment && (
                          <Tooltip title="На объекте нет оборудования вашей специализации">
                            <WarningOutlined style={{ color: '#faad14', marginLeft: 8 }} />
                          </Tooltip>
                        )}
                      </span>
                    }
                    description={<Text type="secondary" style={{ fontSize: 12 }}>{fav.objectCode}</Text>}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      {/* Security */}
      <Card title="Безопасность" size="small">
        <Button icon={<LockOutlined />} onClick={() => navigate('/forgot-password')}>
          Сменить пароль
        </Button>
      </Card>
    </div>
  );
}

// ─── TM Profile ───────────────────────────────────────────────
function TmProfile() {
  const { user } = useAuthStore();
  const { message } = App.useApp();
  const navigate = useNavigate();

  // Team
  const [engineers, setEngineers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  // Favorites with fault indicator
  const [favorites, setFavorites] = useState<any[]>([]);
  const [favLoading, setFavLoading] = useState(false);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const users = await api.getEngineers();
      setEngineers((users || []).filter((u: any) => u.isActive !== false));
    } catch { /* ignore */ }
    setTeamLoading(false);
  }, []);

  const loadFavorites = useCallback(async () => {
    setFavLoading(true);
    try {
      const data = await api.getFavorites();
      setFavorites(Array.isArray(data) ? data : (data as any).data || []);
    } catch { /* ignore */ }
    setFavLoading(false);
  }, []);

  useEffect(() => { loadTeam(); loadFavorites(); }, [loadTeam, loadFavorites]);

  const handleRemoveFavorite = async (objectCode: string) => {
    try {
      await api.removeFavorite(objectCode);
      message.success('Удалено из избранного');
      loadFavorites();
    } catch (err: any) {
      message.error(err.message || 'Ошибка удаления');
    }
  };

  return (
    <div>
      {/* Team list */}
      <Card title={<span><TeamOutlined /> Команда</span>} size="small" style={{ marginBottom: 16 }}>
        {teamLoading ? <Spin /> : engineers.length === 0 ? (
          <Empty description="Нет инженеров в команде" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={engineers}
            renderItem={(eng: any) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<UserOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
                  title={eng.fullName}
                  description={
                    <Space size={4}>
                      {eng.specializationVik && <Tag color="blue">ВиК</Tag>}
                      {eng.specializationIszh && <Tag color="green">ИСЖ</Tag>}
                      {!eng.specializationVik && !eng.specializationIszh && <Text type="secondary">Специализация не выбрана</Text>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Favorites with fault indicators */}
      <Card
        title={<span><StarFilled style={{ color: '#faad14' }} /> Избранные объекты</span>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        {favLoading ? <Spin /> : favorites.length === 0 ? (
          <Empty description="Нет избранных объектов" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={favorites}
            renderItem={(fav: any) => {
              const hasFault = fav.hasFaultyVisit || fav.lastVisitStatus === 'faulty';
              return (
                <List.Item
                  actions={[
                    <Popconfirm title="Удалить из избранного?" onConfirm={() => handleRemoveFavorite(fav.objectCode)} key="del">
                      <Button type="link" size="small" danger><StarFilled /></Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={hasFault ? <Badge status="error" /> : undefined}
                    title={fav.fullAddress || fav.address?.fullAddress || fav.objectCode}
                    description={
                      <Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>{fav.objectCode}</Text>
                        {hasFault && <Tag color="red">Есть неисправности</Tag>}
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      {/* Security */}
      <Card title="Безопасность" size="small">
        <Button icon={<LockOutlined />} onClick={() => navigate('/forgot-password')}>
          Сменить пароль
        </Button>
      </Card>
    </div>
  );
}

// ─── Admin Profile ────────────────────────────────────────────
function AdminProfile() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const quickLinks = [
    { key: '/admin/addresses', icon: <EnvironmentOutlined />, label: 'Адреса' },
    { key: '/admin/equipment', icon: <ToolOutlined />, label: 'Оборудование' },
    { key: '/admin/users', icon: <UserOutlined />, label: 'Пользователи' },
    { key: '/admin/recommendations', icon: <FileTextOutlined />, label: 'Рекомендации' },
    { key: '/admin/import', icon: <ImportOutlined />, label: 'Импорт CSV' },
    { key: '/admin/audit', icon: <AuditOutlined />, label: 'Аудит' },
  ];

  return (
    <div>
      {/* Quick links */}
      <Card title="Быстрый доступ" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {quickLinks.map((link) => (
            <Col span={8} key={link.key}>
              <Button
                block
                icon={link.icon}
                onClick={() => navigate(link.key)}
                style={{ height: 'auto', padding: '12px 8px' }}
              >
                {link.label}
              </Button>
            </Col>
          ))}
        </Row>
      </Card>

      {/* System info */}
      <Card title="Системная информация" size="small" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">Версия: </Text><Text>1.0.0</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">Режим: </Text><Tag color="green">Production</Tag>
        </div>
        <div>
          <Text type="secondary">Онлайн-статус: </Text>
          <Badge status={navigator.onLine ? 'success' : 'error'} text={navigator.onLine ? 'В сети' : 'Офлайн'} />
        </div>
      </Card>

      {/* Security */}
      <Card title="Безопасность" size="small">
        <Button icon={<LockOutlined />} onClick={() => navigate('/forgot-password')}>
          Сменить пароль
        </Button>
      </Card>
    </div>
  );
}

// ─── Main ProfilePage ─────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="page-container" style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0 }}>Профиль</Title>
        </div>
      </div>

      {/* Profile info */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserOutlined style={{ fontSize: 18, color: '#1677ff' }} />
            <Text strong>{user.fullName}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MailOutlined style={{ fontSize: 14, color: '#888' }} />
            <Text type="secondary">{user.email}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SettingOutlined style={{ fontSize: 14, color: '#888' }} />
            <Tag>{ROLE_LABELS[user.role]}</Tag>
          </div>
        </Space>
      </Card>

      <Divider style={{ margin: '12px 0' }} />

      {/* Role-specific content */}
      {user.role === 'engineer' && <EngineerProfile />}
      {user.role === 'tm' && <TmProfile />}
      {user.role === 'admin' && <AdminProfile />}
    </div>
  );
}
