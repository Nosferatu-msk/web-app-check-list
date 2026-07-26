import { Tooltip, App } from 'antd';
import { AudioOutlined, AudioMutedOutlined } from '@ant-design/icons';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
}

export default function VoiceInputButton({ onResult }: VoiceInputButtonProps) {
  const { message } = App.useApp();
  const { state, error, isSupported, toggle } = useSpeechRecognition({ onResult });

  if (!isSupported) return null;

  const isActive = state === 'listening';
  const isDisabled = state === 'disabled';

  const handleClick = () => {
    if (isDisabled) {
      message.info('Голосовой ввод недоступен без интернета');
      return;
    }
    toggle();
  };

  const bgColor = isActive ? '#FEE2E2' : (state === 'error' ? '#FEE2E2' : '#F1F5F9');
  const iconColor = isActive ? '#DC2626' : (state === 'error' ? '#DC2626' : '#64748B');

  const getTooltip = (): string => {
    switch (state) {
      case 'idle': return 'Нажмите для голосового ввода';
      case 'listening': return 'Запись... Нажмите для остановки';
      case 'error': return error || 'Ошибка';
      case 'disabled': return 'Недоступно без интернета';
      default: return '';
    }
  };

  return (
    <Tooltip title={getTooltip()}>
      <span
        onClick={handleClick}
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
