import { Button, Space } from 'antd';
import { ReloadOutlined, CloseOutlined } from '@ant-design/icons';
import { usePWAUpdate } from '../hooks/usePWAUpdate';
import { useIsMobile } from '../hooks/useIsMobile';

export default function PWAUpdateBanner() {
  const { needRefresh, update, close } = usePWAUpdate();
  const isMobile = useIsMobile();

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#1a1a2e',
      color: '#fff',
      padding: isMobile ? '12px 16px' : '10px 16px',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'stretch' : 'center',
      gap: isMobile ? 10 : 8,
      boxShadow: '0 -2px 12px rgba(0,0,0,0.3)',
      borderTop: '2px solid #1677ff',
    }}>
      <span style={{ fontSize: isMobile ? 15 : 14, fontWeight: 500, textAlign: isMobile ? 'center' : 'left' }}>
        🔄 Доступна новая версия приложения
      </span>
      <Space size={8} style={{ justifyContent: isMobile ? 'center' : 'flex-end' }}>
        <Button
          type="primary"
          size={isMobile ? 'middle' : 'small'}
          icon={<ReloadOutlined />}
          onClick={update}
          block={isMobile}
          style={{ fontWeight: 600 }}
        >
          Обновить
        </Button>
        <Button
          type="text"
          size={isMobile ? 'middle' : 'small'}
          icon={<CloseOutlined />}
          onClick={close}
          style={{ color: '#aaa' }}
        />
      </Space>
    </div>
  );
}
