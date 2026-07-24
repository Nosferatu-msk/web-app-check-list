import { Tooltip, App } from 'antd';
import { AudioOutlined, AudioMutedOutlined } from '@ant-design/icons';
import { useSpeechRecognition, VoiceState } from '../hooks/useSpeechRecognition';

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
}

export default function VoiceInputButton({ onResult }: VoiceInputButtonProps) {
  const { message } = App.useApp();
  const { state, error, isSupported, start, stop } = useSpeechRecognition({ onResult });

  if (!isSupported) return null;

  const isActive = state === 'listening';
  const isDisabled = state === 'disabled';
  const isRequesting = state === 'requesting';

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isDisabled) {
      message.info('Голосовой ввод недоступен без подключения к интернету');
      return;
    }
    if (state === 'error') {
      // Clear error, will restart on next press
    }
    start();
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isActive) {
      stop();
    }
  };

  const getIconColor = (): string => {
    switch (state) {
      case 'listening': return '#EF4444';
      case 'error': return '#EF4444';
      case 'disabled': return '#CBD5E1';
      case 'requesting': return '#94A3B8';
      default: return '#94A3B8';
    }
  };

  const getTooltip = (): string => {
    switch (state) {
      case 'idle': return 'Удерживайте для голосового ввода';
      case 'requesting': return 'Запрос доступа к микрофону...';
      case 'listening': return 'Идет запись... Отпустите для остановки';
      case 'error': return error || 'Ошибка';
      case 'disabled': return 'Голосовой ввод недоступен без интернета';
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
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          fontSize: 18,
          color: getIconColor(),
          transition: 'all 0.2s ease',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          ...(isActive ? {
            animation: 'voicePulse 1s ease-in-out infinite',
          } : {}),
        }}
      >
        {state === 'error' ? <AudioMutedOutlined /> : <AudioOutlined />}
        {isActive && (
          <style>{`
            @keyframes voicePulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.15); opacity: 0.7; }
            }
          `}</style>
        )}
      </span>
    </Tooltip>
  );
}
