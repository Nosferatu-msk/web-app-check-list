import { useRef, useEffect, useState } from 'react';
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
  const {
    isListening,
    isSupported,
    interimTranscript,
    newFinalText,
    startListening,
    stopListening,
    clearNewText,
    error,
  } = useSpeechRecognition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPosRef = useRef<number | null>(null);

  // Insert only the NEW chunk of recognized text
  useEffect(() => {
    if (!newFinalText) return;

    const trimmed = newFinalText.trim();
    if (!trimmed) {
      clearNewText();
      return;
    }

    const currentValue = value || '';
    const pos = cursorPosRef.current;

    let newValue: string;
    if (pos !== null && pos >= 0 && pos <= currentValue.length) {
      const before = currentValue.slice(0, pos);
      const after = currentValue.slice(pos);
      const sepBefore = before.endsWith(' ') ? '' : ' ';
      const sepAfter = after.startsWith(' ') ? '' : ' ';
      newValue = before + sepBefore + trimmed + sepAfter + after;
      cursorPosRef.current = (before + sepBefore + trimmed + sepAfter).length;
    } else {
      newValue = currentValue ? currentValue.trimEnd() + ' ' + trimmed : trimmed;
      cursorPosRef.current = newValue.length;
    }

    onChange?.(newValue);
    clearNewText();
  }, [newFinalText]);

  useEffect(() => {
    if (error) {
      if (error.includes('запрещён')) {
        antMessage.error(error);
      } else {
        antMessage.warning(error);
      }
    }
  }, [error]);

  const handleClick = () => {
    if (!isOnline()) return;

    if (isListening) {
      stopListening();
      return;
    }

    if (!localStorage.getItem(PRIVACY_KEY)) {
      antMessage.info('Голосовой ввод использует сервисы распознавания речи вашего браузера. Не диктуйте конфиденциальную информацию.');
      localStorage.setItem(PRIVACY_KEY, 'true');
    }

    const ta = textareaRef.current;
    if (ta) {
      cursorPosRef.current = ta.selectionStart ?? value.length;
    } else {
      cursorPosRef.current = value.length;
    }

    startListening();
  };

  const isOnline = () => typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isSupported) {
    return (
      <TextArea
        ref={textareaRef as any}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  }

  const isDisabled = disabled || !isOnline();

  let micColor = '#94A3B8';
  let tooltipText = 'Нажмите для голосового ввода';

  if (!isOnline()) {
    micColor = '#d1d5db80';
    tooltipText = 'Голосовой ввод недоступен без подключения к интернету';
  } else if (isListening) {
    micColor = '#ef4444';
    tooltipText = 'Идёт запись… Нажмите для остановки';
  } else if (error) {
    micColor = '#ef4444';
    tooltipText = error;
  }

  return (
    <div style={{ position: 'relative' }}>
      <TextArea
        ref={textareaRef as any}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        style={{ paddingRight: 36 }}
      />

      {isListening && interimTranscript && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 12,
          right: 40,
          fontStyle: 'italic',
          color: '#999',
          fontSize: 13,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {interimTranscript}
        </div>
      )}

      <Tooltip title={tooltipText} placement="left">
        <button
          type="button"
          onClick={handleClick}
          disabled={isDisabled}
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            width: 28,
            height: 28,
            border: 'none',
            borderRadius: '50%',
            background: isListening ? '#fef2f2' : '#f5f5f5',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: micColor,
            fontSize: 16,
            padding: 0,
            transition: 'all 0.2s',
            animation: isListening ? 'pulse-mic 1.5s ease-in-out infinite' : 'none',
          }}
        >
          <AudioOutlined />
        </button>
      </Tooltip>

      <style>{`
        @keyframes pulse-mic {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
