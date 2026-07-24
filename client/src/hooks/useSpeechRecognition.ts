import { useState, useRef, useCallback, useEffect } from 'react';

export type VoiceState = 'idle' | 'requesting' | 'listening' | 'error' | 'disabled';

interface UseSpeechRecognitionOptions {
  onResult: (text: string) => void;
  silenceTimeout?: number;
}

interface UseSpeechRecognitionReturn {
  state: VoiceState;
  error: string | null;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useSpeechRecognition({
  onResult,
  silenceTimeout = 5000,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListeningRef = useRef(false);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Update disabled state based on network
  useEffect(() => {
    if (!isOnline && state === 'idle') {
      setState('disabled');
    } else if (isOnline && state === 'disabled') {
      setState('idle');
    }
  }, [isOnline, state]);

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

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      if (isListeningRef.current) {
        stopRecognition();
      }
    }, silenceTimeout);
  }, [silenceTimeout]);

  const stopRecognition = useCallback(() => {
    isListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setState('idle');
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

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'ru-RU';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('listening');
      isListeningRef.current = true;
      resetSilenceTimer();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer();
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const trimmed = transcript.trim();
      if (trimmed) {
        onResult(trimmed);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      isListeningRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      switch (event.error) {
        case 'not-allowed':
          setError('Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.');
          break;
        case 'no-speech':
          setError('Речь не обнаружена. Попробуйте еще раз.');
          break;
        case 'network':
          setError('Связь потеряна. Голосовой ввод остановлен.');
          break;
        case 'aborted':
          // Normal stop, no error
          break;
        default:
          setError('Не удалось распознать речь. Попробуйте еще раз или введите текст вручную.');
      }

      if (event.error !== 'aborted') {
        setState('error');
      } else {
        setState('idle');
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      // Only set idle if not already in error state
      setState(prev => prev === 'error' ? prev : 'idle');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError('Не удалось запустить распознавание речи.');
      setState('error');
    }
  }, [isSupported, onResult, resetSilenceTimer]);

  const toggle = useCallback(() => {
    if (isListeningRef.current) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [startRecognition, stopRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    error,
    isSupported,
    start: startRecognition,
    stop: stopRecognition,
    toggle,
  };
}
