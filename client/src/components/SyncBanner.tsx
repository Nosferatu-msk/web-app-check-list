import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Button, Tag, Space, Tooltip } from 'antd';
import { WifiOutlined, CloudServerOutlined, SyncOutlined, WarningOutlined } from '@ant-design/icons';

export default function SyncBanner() {
  const { isOnline, syncStatus, pendingCount, lastSyncError, sync } = useOnlineStatus();

  if (isOnline && syncStatus === 'idle' && pendingCount === 0) return null;

  return (
    <div style={{
      padding: '6px 16px',
      fontSize: 13,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      background: !isOnline ? '#fff7e6' : syncStatus === 'syncing' ? '#e6f7ff' : syncStatus === 'error' ? '#fff1f0' : '#f6ffed',
      borderBottom: '1px solid #f0f0f0',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      {!isOnline ? (
        <>
          <WifiOutlined style={{ color: '#fa8c16' }} />
          <span style={{ color: '#d48806', fontWeight: 500 }}>Офлайн-режим</span>
          <Tag color="orange">Данные сохраняются локально</Tag>
        </>
      ) : syncStatus === 'syncing' ? (
        <>
          <SyncOutlined spin style={{ color: '#1677ff' }} />
          <span style={{ color: '#1677ff' }}>Синхронизация...</span>
          {pendingCount > 0 && <Tag color="blue">{pendingCount} операций</Tag>}
        </>
      ) : syncStatus === 'error' ? (
        <>
          <WarningOutlined style={{ color: '#ff4d4f' }} />
          <span style={{ color: '#ff4d4f' }}>{lastSyncError || 'Ошибка синхронизации'}</span>
          <Button type="link" size="small" onClick={sync}>Повторить</Button>
        </>
      ) : pendingCount > 0 ? (
        <>
          <CloudServerOutlined style={{ color: '#52c41a' }} />
          <span style={{ color: '#389e0d' }}>Онлайн</span>
          <Tooltip title="Есть несохранённые данные">
            <Tag color="gold" style={{ cursor: 'pointer' }} onClick={sync}>
              <SyncOutlined /> {pendingCount} ожидает
            </Tag>
          </Tooltip>
        </>
      ) : null}
    </div>
  );
}
