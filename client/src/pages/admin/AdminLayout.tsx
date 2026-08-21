import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Drawer, App, Breadcrumb } from 'antd';
import type { MenuProps } from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined, ToolOutlined, HomeOutlined, FileTextOutlined, UserOutlined, AuditOutlined, MenuOutlined, TeamOutlined, ImportOutlined, CheckCircleOutlined, ShopOutlined, AppstoreOutlined, RocketOutlined, ExperimentOutlined, LinkOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import NotificationBell from '../../components/NotificationBell';

const { Content } = Layout;

const pageLabels: Record<string, string> = {
  '/admin/addresses': 'Адреса',
  '/admin/equipment': 'Оборудование',
  '/admin/manufacturers': 'Производители',
  '/admin/models': 'Модели',
  '/admin/rooms': 'Помещения',
  '/admin/recommendations': 'Рекомендации',
  '/admin/users': 'Пользователи',
  '/admin/tm-assignments': 'Привязки ТМ',
  '/admin/import': 'Импорт CSV',
  '/admin/object-equipment': 'Оборудование объектов',
  '/admin/proposals': 'Модерация',
  '/admin/mtr-work-types': 'МТР: Виды работ',
  '/admin/mtr-assignments': 'МТР: Привязки',
  '/admin/system-notifications': 'Уведомления',
  '/admin/audit': 'Аудит',
};

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <ArrowLeftOutlined />, label: 'Визиты' },
  { type: 'group', label: 'Объекты', children: [
    { key: '/admin/addresses', icon: <EnvironmentOutlined />, label: 'Адреса' },
    { key: '/admin/object-equipment', icon: <ToolOutlined />, label: 'Оборудование объектов' },
    { key: '/admin/rooms', icon: <HomeOutlined />, label: 'Помещения' },
  ]},
  { type: 'group', label: 'Справочники', children: [
    { key: '/admin/equipment', icon: <ToolOutlined />, label: 'Оборудование' },
    { key: '/admin/manufacturers', icon: <ShopOutlined />, label: 'Производители' },
    { key: '/admin/models', icon: <AppstoreOutlined />, label: 'Модели' },
    { key: '/admin/recommendations', icon: <FileTextOutlined />, label: 'Рекомендации' },
  ]},
  { type: 'group', label: 'Пользователи', children: [
    { key: '/admin/users', icon: <UserOutlined />, label: 'Пользователи' },
    { key: '/admin/tm-assignments', icon: <TeamOutlined />, label: 'Привязки ТМ' },
  ]},
  { type: 'group', label: 'МТР', children: [
    { key: '/admin/mtr-work-types', icon: <ExperimentOutlined />, label: 'Виды работ' },
    { key: '/admin/mtr-assignments', icon: <LinkOutlined />, label: 'Привязки' },
  ]},
  { type: 'group', label: 'Система', children: [
    { key: '/admin/proposals', icon: <CheckCircleOutlined />, label: 'Модерация' },
    { key: '/admin/import', icon: <ImportOutlined />, label: 'Импорт CSV' },
    { key: '/admin/system-notifications', icon: <RocketOutlined />, label: 'Уведомления' },
    { key: '/admin/audit', icon: <AuditOutlined />, label: 'Аудит' },
  ]},
];

export default function AdminLayout() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleMenuClick = (key: string) => {
    navigate(key);
    setDrawerOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px', fontWeight: 700, fontSize: 18, color: '#0F766E', borderBottom: '1px solid #f0f0f0' }}>
        <ToolOutlined style={{ fontSize: 20, color: '#0F766E', marginRight: 8 }} />Админ-панель
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => handleMenuClick(key)}
        style={{ flex: 1, borderRight: 0 }}
      />
      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
        <Button onClick={handleLogout} block danger>
          Выход
        </Button>
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop sidebar — visible on screens >= 768px */}
      <Layout.Sider
        breakpoint="md"
        collapsedWidth={0}
        theme="light"
        style={{
          display: 'block',
          boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
        }}
        width={260}
      >
        {sidebarContent}
      </Layout.Sider>

      <Layout>
        {/* Mobile header — visible on screens < 768px */}
        <div
          className="admin-mobile-header"
          style={{
            display: 'none',
            padding: '12px 16px',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ fontSize: 20 }}
          />
          <span style={{ fontWeight: 700, fontSize: 16, color: '#0F766E' }}><ToolOutlined style={{ marginRight: 4 }} />Админ</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationBell />
            <Button type="text" onClick={handleLogout} size="small">Выход</Button>
          </div>
        </div>

        <Content
          className="admin-content"
          style={{
            margin: '16px auto',
            padding: '20px',
            background: '#fff',
            borderRadius: 12,
            minHeight: 360,
            maxWidth: 1400,
          }}
        >
          {location.pathname !== '/' && pageLabels[location.pathname] && (
            <Breadcrumb style={{ marginBottom: 16 }} items={[
              { title: <a onClick={() => navigate('/')}>Главная</a> },
              { title: pageLabels[location.pathname] },
            ]} />
          )}
          <Outlet />
        </Content>
      </Layout>

      {/* Mobile drawer navigation */}
      <Drawer
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        {sidebarContent}
      </Drawer>
    </Layout>
  );
}
