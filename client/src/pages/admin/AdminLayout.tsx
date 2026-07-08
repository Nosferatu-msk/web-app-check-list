import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Drawer, App } from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined, ToolOutlined, HomeOutlined, FileTextOutlined, UserOutlined, AuditOutlined, MenuOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Content } = Layout;

const menuItems = [
  { key: '/admin/addresses', icon: <EnvironmentOutlined />, label: 'Адреса' },
  { key: '/admin/equipment', icon: <ToolOutlined />, label: 'Оборудование' },
  { key: '/admin/rooms', icon: <HomeOutlined />, label: 'Помещения' },
  { key: '/admin/recommendations', icon: <FileTextOutlined />, label: 'Рекомендации' },
  { key: '/admin/users', icon: <UserOutlined />, label: 'Пользователи' },
  { key: '/admin/tm-assignments', icon: <TeamOutlined />, label: 'Привязки ТМ' },
  { key: '/admin/audit', icon: <AuditOutlined />, label: 'Аудит' },
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
      <div style={{ padding: '16px', fontWeight: 700, fontSize: 18, color: '#1677ff', borderBottom: '1px solid #f0f0f0' }}>
        🔧 Админ-панель
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => handleMenuClick(key)}
        style={{ flex: 1, borderRight: 0 }}
      />
      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} block style={{ marginBottom: 8 }}>
          К визитам
        </Button>
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
          <span style={{ fontWeight: 700, fontSize: 16, color: '#1677ff' }}>🔧 Админ</span>
          <Button type="text" onClick={handleLogout} size="small">Выход</Button>
        </div>

        <Content
          className="admin-content"
          style={{
            margin: '16px',
            padding: '20px',
            background: '#fff',
            borderRadius: 12,
            minHeight: 360,
          }}
        >
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
