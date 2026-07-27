import { useEffect, useState, useRef } from 'react';
import { Badge, List, Typography, Button, Spin, Empty, Modal, Drawer, Tag } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useIsMobile } from '../hooks/useIsMobile';
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
  request_assigned: '📌',
  request_unassigned: '📌',
  request_declined: '📌',
  request_imported: '📌',
  system_release: '🚀',
};

function getNotificationLink(item: any): string | null {
  switch (item.type) {
    case 'proposal_created':
    case 'proposal_approved':
    case 'proposal_rejected':
    case 'proposal_expiring_soon':
    case 'proposal_expired':
      return '/admin/proposals';
    case 'equipment_removed':
      return '/admin/object-equipment';
    case 'request_assigned':
    case 'request_unassigned':
      return '/my-requests';
    case 'request_declined':
    case 'request_imported':
      return '/requests';
    case 'system_release':
      return '/profile';
    default:
      return null;
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const load = async () => {
    try {
      const result = await api.getNotifications({ limit: '20' });
      setNotifications(result.data || []);
      setUnreadCount(result.unreadCount || 0);
    } catch { /* silent */ }
  };

  useEffect(() => { load(); }, []);

  // Закрытие при клике вне (только для десктопного dropdown)
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, isMobile]);

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

  const handleClearAll = async () => {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const showClearConfirm = () => {
    Modal.confirm({
      title: 'Очистить уведомления?',
      content: 'Все уведомления будут удалены из списка. Это действие нельзя отменить.',
      okText: 'Очистить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: handleClearAll,
    });
  };

  const handleClickNotification = (item: any) => {
    if (!item.isRead) {
      handleMarkRead(item.id);
    }
    const link = getNotificationLink(item);
    if (link) {
      setOpen(false);
      navigate(link);
    }
  };

  const renderNotificationItem = (item: any) => {
    const isSystemRelease = item.type === 'system_release';
    const stripeColor = isSystemRelease ? '#52c41a' : '#1677ff';

    return (
      <List.Item
        style={{
          padding: '10px 16px',
          background: item.isRead ? '#fff' : '#f6f8ff',
          cursor: 'pointer',
          borderBottom: '1px solid #f5f5f5',
          borderLeft: item.isRead ? 'none' : `4px solid ${stripeColor}`,
        }}
        onClick={() => handleClickNotification(item)}
      >
        <List.Item.Meta
          avatar={<span style={{ fontSize: 20, flexShrink: 0 }}>{TYPE_ICONS[item.type] || '📌'}</span>}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Typography.Text style={{
                fontSize: 13,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                fontWeight: item.isRead ? 'normal' : 'bold',
              }}>
                {item.title}
              </Typography.Text>
              {isSystemRelease && !item.isRead && (
                <Tag color="#52c41a" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                  NEW FEATURE
                </Tag>
              )}
            </div>
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
    );
  };

  const notificationList = (
    <>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : notifications.length === 0 ? (
          <Empty description="Нет уведомлений" style={{ padding: 24 }} />
        ) : (
          <List
            dataSource={notifications}
            renderItem={renderNotificationItem}
          />
        )}
      </div>
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        gap: 8,
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        {unreadCount > 0 && (
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead} block={isMobile}>
            {isMobile ? '✓ Прочитано' : 'Прочитать всё'}
          </Button>
        )}
        <Button
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          disabled={notifications.length === 0}
          block={isMobile}
          onClick={showClearConfirm}
        >
          {isMobile ? '🗑 Очистить' : 'Очистить'}
        </Button>
      </div>
    </>
  );

  // Мобильная версия — Drawer на весь экран
  if (isMobile) {
    return (
      <>
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            icon={<BellOutlined style={{ fontSize: 20 }} />}
            onClick={() => { setOpen(true); if (true) load(); }}
            style={{ padding: '4px 8px' }}
          />
        </Badge>
        <Drawer
          title="Уведомления"
          placement="right"
          onClose={() => setOpen(false)}
          open={open}
          width="100%"
          styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
          extra={<Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} />}
        >
          {notificationList}
        </Drawer>
      </>
    );
  }

  // Десктопная версия — dropdown
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
          {notificationList}
        </div>
      )}
    </div>
  );
}
