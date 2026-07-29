import { Button, Space } from 'antd';
import { ReloadOutlined, CloseOutlined } from '@ant-design/icons';
import { usePWAUpdate } from '../hooks/usePWAUpdate';

export default function PWAUpdateBanner() {
  const { needRefresh, update, close } = usePWAUpdate();

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#1677ff',
      color: '#fff',
      padding: '10px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      boxShadow: '0 -2px 8px rgba(0,0,0,0.15)',
    }}>
      <span style={{ fontSize: 14 }}>Доступна новая версия приложения</span>
      <Space size={4}>
        <Button type="primary" ghost size="small" icon={<ReloadOutlined />} onClick={update}>
          Обновить
        </Button>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={close} style={{ color: '#fff' }} />
      </Space>
    </div>
  );
}
