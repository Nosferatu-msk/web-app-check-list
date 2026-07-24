import { useState, useRef, useCallback, useEffect } from 'react';

export type VoiceState = 'idle' | 'requesting' | 'listening' | 'error' | 'disabled';

interface UseSpeechRecognitionOptions {
  onResult: (text: string) => void;
}

interface UseSpeechRecognitionReturn {
  state: VoiceState;
  error: string | null;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition({
  onResult,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const accumulatedRef = useRef('');

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Network state tracking
  useEffect(() => {
    const handleOnline = () => { if (state === 'disabled') setState('idle'); };
    const handleOffline = () => {
      if (isListeningRef.current) {
        stopRecognition();
      }
      setState('disabled');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state]);

  const stopRecognition = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const startRecognition = useCallback(() => {
    if (!isSupported) {
      setError('Голосовой ввод не поддерживается в этом браузере');
      setState('error');
      return;
    }

    if (!navigator.onLine) {
      setState('disabled');
      return;
    }

    setError(null);
    setState('requesting');
    accumulatedRef.current = '';

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('listening');
      isListeningRef.current = true;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Accumulate only final results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) {
            accumulatedRef.current = accumulatedRef.current
              ? `${accumulatedRef.current} ${text}`
              : text;
          }
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      isListeningRef.current = false;

      switch (event.error) {
        case 'not-allowed':
          setError('Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.');
          break;
        case 'no-speech':
          // No speech detected, just go idle
          break;
        case 'network':
          setError('Связь потеряна. Голосовой ввод остановлен.');
          break;
        case 'aborted':
          break;
        default:
          setError('Не удалось распознать речь. Попробуйте еще раз.');
      }

      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setState('error');
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      // Deliver accumulated text
      const text = accumulatedRef.current.trim();
      accumulatedRef.current = '';
      if (text) {
        onResult(text);
      }
      setState(prev => (prev === 'error' ? prev : 'idle'));
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError('Не удалось запустить распознавание речи.');
      setState('error');
    }
  }, [isSupported, onResult]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, []);

  return {
    state,
    error,
    isSupported,
    start: startRecognition,
    stop: stopRecognition,
  };
}
