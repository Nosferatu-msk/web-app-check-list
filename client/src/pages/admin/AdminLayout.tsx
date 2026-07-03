import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button } from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined, ToolOutlined, HomeOutlined, FileTextOutlined, UserOutlined, AuditOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/admin/addresses', icon: <EnvironmentOutlined />, label: 'Адреса' },
  { key: '/admin/equipment', icon: <ToolOutlined />, label: 'Оборудование' },
  { key: '/admin/rooms', icon: <HomeOutlined />, label: 'Помещения' },
  { key: '/admin/recommendations', icon: <FileTextOutlined />, label: 'Рекомендации' },
  { key: '/admin/users', icon: <UserOutlined />, label: 'Пользователи' },
  { key: '/admin/audit', icon: <AuditOutlined />, label: 'Аудит' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0} theme="light">
        <div style={{ padding: '16px', fontWeight: 700, fontSize: 16, color: '#1677ff' }}>🔧 Админ</div>
        <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} />
        <div style={{ padding: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} block>К визитам</Button>
        </div>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Button onClick={() => { logout(); navigate('/login'); }}>Выход</Button>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
