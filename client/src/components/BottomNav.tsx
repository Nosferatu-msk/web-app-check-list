import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UnorderedListOutlined, FormOutlined, BarChartOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [hidden, setHidden] = useState(false);

  const isEngineer = user?.role === 'engineer';

  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport) {
        const isKeyboardOpen = window.visualViewport.height < window.innerHeight * 0.75;
        setHidden(isKeyboardOpen);
      }
    };

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        setHidden(true);
      }
    };

    const handleBlur = () => {
      setTimeout(() => setHidden(false), 100);
    };

    window.visualViewport?.addEventListener('resize', handleViewportResize);
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  if (!isEngineer) return null;

  const items: NavItem[] = [
    { key: 'visits', icon: <UnorderedListOutlined />, label: 'Визиты', path: '/' },
    { key: 'requests', icon: <FormOutlined />, label: 'Заявки', path: '/my-requests' },
    { key: 'profile', icon: <UserOutlined />, label: 'Профиль', path: '/profile' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className={`bottom-nav ${hidden ? 'bottom-nav-hidden' : ''}`} role="navigation" aria-label="Основная навигация">
      {items.map((item) => (
        <div
          key={item.key}
          className={`bottom-nav-item ${isActive(item.path) ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
          role="tab"
          aria-selected={isActive(item.path)}
          aria-label={item.label}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(item.path); }}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.badge && item.badge > 0 && (
            <span className="bottom-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
