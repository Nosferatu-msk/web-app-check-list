import { useRef, useEffect } from 'react';
import { Input, Tooltip, App } from 'antd';
import { AudioOutlined } from '@ant-design/icons';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

const { TextArea } = Input;

interface VoiceInputProps {
  value?: string;
  onChange?: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}

const PRIVACY_KEY = 'voice_input_privacy_acknowledged';

export default function VoiceInput({ value = '', onChange, rows = 3, placeholder, disabled }: VoiceInputProps) {
  const { message: antMessage } = App.useApp();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const insertText = (chunk: string) => {
    if (!chunk) return;
    const cur = valueRef.current || '';
    const ta = textareaRef.current;
    const pos = ta?.selectionStart ?? cur.length;
    const before = cur.slice(0, pos);
    const after = cur.slice(pos);
    const sep = before.endsWith(' ') || after.startsWith(' ') ? '' : ' ';
    const next = before + sep + chunk + (after && !after.startsWith(' ') ? ' ' : '') + after;
    onChange?.(next);
    valueRef.current = next;
  };

  const { state, isSupported, start, stop, error } = useSpeechRecognition({ onResult: insertText });
  const isListening = state === 'listening';

  useEffect(() => {
    if (error) {
      error.includes('запрещён') ? antMessage.error(error) : antMessage.warning(error);
    }
  }, [error]);

  const handleClick = () => {
    if (!navigator.onLine) return;

    if (isListening) {
      stop();
      return;
    }

    if (!localStorage.getItem(PRIVACY_KEY)) {
      antMessage.info('Голосовой ввод использует сервисы распознавания речи вашего браузера. Не диктуйте конфиденциальную информацию.');
      localStorage.setItem(PRIVACY_KEY, 'true');
    }

    start();
  };

  if (!isSupported) {
    return <TextArea ref={textareaRef as any} value={value} onChange={e => onChange?.(e.target.value)} rows={rows} placeholder={placeholder} disabled={disabled} />;
  }

  const offline = !navigator.onLine;
  const isDisabled = disabled || offline;

  let micColor = '#94A3B8';
  let tip = 'Нажмите для голосового ввода';
  if (offline) { micColor = '#d1d5db80'; tip = 'Голосовой ввод недоступен без интернета'; }
  else if (isListening) { micColor = '#ef4444'; tip = 'Идёт запись… Нажмите для остановки'; }
  else if (error) { micColor = '#ef4444'; tip = error; }

  return (
    <div style={{ position: 'relative' }}>
      <TextArea
        ref={textareaRef as any}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        style={{ paddingRight: 36 }}
      />
      {isListening && (
        <div style={{ position: 'absolute', bottom: 8, left: 12, right: 40, fontStyle: 'italic', color: '#999', fontSize: 13, pointerEvents: 'none' }}>
          Слушаю...
        </div>
      )}
      <Tooltip title={tip} placement="left">
        <button type="button" onClick={handleClick} disabled={isDisabled}
          style={{ position: 'absolute', right: 8, bottom: 8, width: 28, height: 28, border: 'none', borderRadius: '50%', background: isListening ? '#fef2f2' : '#f5f5f5', cursor: isDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: micColor, fontSize: 16, padding: 0, transition: 'all 0.2s', animation: isListening ? 'vmic 1.5s ease-in-out infinite' : 'none' }}>
          <AudioOutlined />
        </button>
      </Tooltip>
      <style>{`@keyframes vmic{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{transform:scale(1.1);box-shadow:0 0 0 6px rgba(239,68,68,0)}}`}</style>
    </div>
  );
}
