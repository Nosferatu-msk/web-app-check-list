import { useEffect, useState, useRef } from 'react';
import { Badge, List, Typography, Button, Spin, Empty } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const TYPE_ICONS: Record<string, string> = {
  proposal_created: '📋',
  proposal_approved: '✅',
  proposal_rejected: '❌',
  proposal_expiring_soon: '⏰',
  proposal_expired: '⌛',
  equipment_removed: '🗑️',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const result = await api.getNotifications({ limit: '20' });
      setNotifications(result.data || []);
      setUnreadCount(result.unreadCount || 0);
    } catch { /* silent */ }
  };

  useEffect(() => { load(); }, []);

  // Закрытие при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Автообновление каждые 60 сек
  useEffect(() => {
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-block' }}>
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 20 }} />}
          onClick={() => { setOpen(!open); if (!open) load(); }}
          style={{ padding: '4px 8px' }}
        />
      </Badge>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: 'min(380px, calc(100vw - 16px))',
          maxHeight: 'min(480px, calc(100vh - 100px))',
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
          zIndex: 1050,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text strong>Уведомления</Typography.Text>
            {unreadCount > 0 && (
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
                Прочитать все
              </Button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : notifications.length === 0 ? (
              <Empty description="Нет уведомлений" style={{ padding: 24 }} />
            ) : (
              <List
                dataSource={notifications}
                renderItem={(item: any) => (
                  <List.Item
                    style={{
                      padding: '10px 16px',
                      background: item.isRead ? '#fff' : '#f6f8ff',
                      cursor: item.isRead ? 'default' : 'pointer',
                      borderBottom: '1px solid #f5f5f5',
                    }}
                    onClick={() => !item.isRead && handleMarkRead(item.id)}
                  >
                    <List.Item.Meta
                      avatar={<span style={{ fontSize: 20, flexShrink: 0 }}>{TYPE_ICONS[item.type] || '📌'}</span>}
                      title={
                        <Typography.Text style={{ fontSize: 13, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {item.title}
                        </Typography.Text>
                      }
                      description={
                        <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          <div style={{ fontSize: 12, color: '#555' }}>{item.message}</div>
                          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                            {dayjs(item.createdAt).fromNow()}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
