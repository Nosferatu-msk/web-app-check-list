import { Tooltip, App } from 'antd';
import { AudioOutlined, AudioMutedOutlined } from '@ant-design/icons';
import { useSpeechRecognition, VoiceState } from '../hooks/useSpeechRecognition';

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
}

const STATE_CONFIG: Record<VoiceState, { color: string; tooltip: string; pulse: boolean }> = {
  idle: { color: '#94A3B8', tooltip: 'Нажмите для голосового ввода', pulse: false },
  requesting: { color: '#94A3B8', tooltip: 'Запрос доступа к микрофону...', pulse: true },
  listening: { color: '#EF4444', tooltip: 'Идет запись... Нажмите, чтобы остановить', pulse: true },
  error: { color: '#EF4444', tooltip: 'Ошибка', pulse: false },
  disabled: { color: '#CBD5E1', tooltip: 'Голосовой ввод недоступен без подключения к интернету. Используйте текстовый ввод.', pulse: false },
};

export default function VoiceInputButton({ onResult }: VoiceInputButtonProps) {
  const { message } = App.useApp();
  const { state, error, isSupported, toggle } = useSpeechRecognition({ onResult });

  if (!isSupported) return null;

  const config = STATE_CONFIG[state];
  const isActive = state === 'listening';
  const isDisabled = state === 'disabled';

  const handleClick = () => {
    if (isDisabled) {
      message.info(config.tooltip);
      return;
    }
    if (state === 'error') {
      // Clear error and try again
      toggle();
      return;
    }
    toggle();
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 18,
    color: config.color,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'all 0.2s ease',
  };

  if (isActive) {
    return (
      <Tooltip title={config.tooltip}>
        <span onClick={handleClick} style={iconStyle}>
          <span className="voice-pulse">
            <AudioOutlined />
          </span>
          <style>{`
            @keyframes voicePulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.2); opacity: 0.7; }
            }
            .voice-pulse {
              display: inline-flex;
              animation: voicePulse 1.2s ease-in-out infinite;
            }
          `}</style>
        </span>
      </Tooltip>
    );
  }

  if (state === 'requesting') {
    return (
      <Tooltip title={config.tooltip}>
        <span style={iconStyle}>
          <span className="voice-spin">
            <AudioOutlined />
          </span>
          <style>{`
            @keyframes voiceSpin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .voice-spin {
              display: inline-flex;
              animation: voiceSpin 1s linear infinite;
            }
          `}</style>
        </span>
      </Tooltip>
    );
  }

  if (state === 'error' && error) {
    return (
      <Tooltip title={error}>
        <span onClick={handleClick} style={iconStyle}>
          <AudioMutedOutlined />
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={config.tooltip}>
      <span onClick={handleClick} style={iconStyle}>
        <AudioOutlined />
      </span>
    </Tooltip>
  );
}
