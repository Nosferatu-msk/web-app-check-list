import { useRef, useState, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  interimText: string;
  start: (onFinal: (text: string) => void) => void;
  stop: () => void;
  error: string | null;
}

const SILENCE_TIMEOUT_MS = 5000;

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalRef = useRef<((text: string) => void) | null>(null);

  const SpeechAPI = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  const isSupported = !!SpeechAPI;

  const resetTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
    }, SILENCE_TIMEOUT_MS);
  }, []);

  const clearTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const start = useCallback((onFinal: (text: string) => void) => {
    if (!SpeechAPI) {
      setError('Голосовой ввод не поддерживается вашим браузером');
      return;
    }

    setError(null);
    setInterimText('');
    onFinalRef.current = onFinal;

    const recognition = new SpeechAPI();
    recognition.lang = 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      resetTimer();
    };

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      resetTimer();
      let interim = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          onFinalRef.current?.(r[0].transcript.trim());
        } else {
          interim += r[0].transcript;
        }
      }

      setInterimText(interim);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'aborted') return;
      const msgs: Record<string, string> = {
        'not-allowed': 'Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.',
        'no-speech': 'Речь не обнаружена. Попробуйте ещё раз.',
        'network': 'Ошибка сети. Проверьте подключение к интернету.',
        'audio-capture': 'Микрофон не найден.',
      };
      setError(msgs[e.error] || 'Не удалось распознать речь.');
      setIsListening(false);
      clearTimer();
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
      clearTimer();
      onFinalRef.current = null;
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setError('Не удалось запустить распознавание.'); }
  }, [SpeechAPI, resetTimer, clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, [clearTimer]);

  useEffect(() => () => {
    clearTimer();
    recognitionRef.current?.abort();
  }, [clearTimer]);

  return { isListening, isSupported, interimText, start, stop, error };
}
