import { Tooltip, App } from 'antd';
import { AudioOutlined, AudioMutedOutlined } from '@ant-design/icons';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
}

export default function VoiceInputButton({ onResult }: VoiceInputButtonProps) {
  const { message } = App.useApp();
  const { state, error, isSupported, start, stop } = useSpeechRecognition({ onResult });

  if (!isSupported) return null;

  const isActive = state === 'listening';
  const isDisabled = state === 'disabled';

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDisabled) {
      message.info('Голосовой ввод недоступен без интернета');
      return;
    }
    start();
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isActive) {
      stop();
    }
  };

  const bgColor = isActive ? '#FEE2E2' : (state === 'error' ? '#FEE2E2' : '#F1F5F9');
  const iconColor = isActive ? '#DC2626' : (state === 'error' ? '#DC2626' : '#64748B');

  const getTooltip = (): string => {
    switch (state) {
      case 'idle': return 'Удерживайте для голосового ввода';
      case 'listening': return 'Запись... Отпустите для остановки';
      case 'error': return error || 'Ошибка';
      case 'disabled': return 'Недоступно без интернета';
      default: return '';
    }
  };

  return (
    <Tooltip title={getTooltip()}>
      <span
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: '50%',
          backgroundColor: bgColor,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          fontSize: 20,
          color: iconColor,
          transition: 'all 0.15s ease',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
          ...(isActive ? {
            backgroundColor: '#FECACA',
            transform: 'scale(1.1)',
            boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.3)',
          } : {}),
        }}
      >
        {state === 'error' ? <AudioMutedOutlined /> : <AudioOutlined />}
      </span>
    </Tooltip>
  );
}
