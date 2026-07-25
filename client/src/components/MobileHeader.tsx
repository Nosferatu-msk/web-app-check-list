import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import TorchButton from './TorchButton';
import NotificationBell from './NotificationBell';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  showTorch?: boolean;
}

export default function MobileHeader({ title, showBack = false, onBack, actions, showTorch = false }: MobileHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="mobile-header safe-area-top" role="banner">
      {showBack && (
        <button
          onClick={handleBack}
          style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Назад"
        >
          <ArrowLeftOutlined style={{ fontSize: 18 }} />
        </button>
      )}
      <div className="mobile-header-title" title={title}>
        {title}
      </div>
      <div className="mobile-header-actions">
        {actions}
        {showTorch && <TorchButton />}
        <NotificationBell />
      </div>
    </header>
  );
}
