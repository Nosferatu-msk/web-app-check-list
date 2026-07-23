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
  const activeRef = useRef(false);
  const pendingFinalRef = useRef('');

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

  const createRecognition = useCallback((onFinal: (text: string) => void) => {
    if (!SpeechAPI) return null;

    const recognition = new SpeechAPI();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = true;
    pendingFinalRef.current = '';

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      resetTimer();
      let interim = '';
      let final = '';

      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }

      if (final) pendingFinalRef.current = final.trim();
      setInterimText(interim);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      const msgs: Record<string, string> = {
        'not-allowed': 'Доступ к микрофону запрещён.',
        'network': 'Ошибка сети.',
        'audio-capture': 'Микрофон не найден.',
      };
      setError(msgs[e.error] || 'Не удалось распознать речь.');
      activeRef.current = false;
      setIsListening(false);
      clearTimer();
    };

    recognition.onend = () => {
      clearTimer();
      setInterimText('');

      // Insert the final text from this segment
      if (pendingFinalRef.current) {
        onFinal(pendingFinalRef.current);
        pendingFinalRef.current = '';
      }

      // Auto-restart if still active
      if (activeRef.current) {
        const next = createRecognition(onFinal);
        if (next) {
          recognitionRef.current = next;
          try { next.start(); } catch { activeRef.current = false; setIsListening(false); }
        }
      } else {
        setIsListening(false);
        recognitionRef.current = null;
      }
    };

    return recognition;
  }, [SpeechAPI, resetTimer, clearTimer]);

  const start = useCallback((onFinal: (text: string) => void) => {
    if (!SpeechAPI) { setError('Голосовой ввод не поддерживается'); return; }

    setError(null);
    setInterimText('');
    activeRef.current = true;
    onFinalRef.current = onFinal;

    const recognition = createRecognition(onFinal);
    if (!recognition) return;

    recognitionRef.current = recognition;
    try { recognition.start(); setIsListening(true); } catch { setError('Не удалось запустить распознавание.'); }
  }, [SpeechAPI, createRecognition]);

  const stop = useCallback(() => {
    activeRef.current = false;
    clearTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, [clearTimer]);

  useEffect(() => () => {
    activeRef.current = false;
    clearTimer();
    recognitionRef.current?.abort();
  }, [clearTimer]);

  return { isListening, isSupported, interimText, start, stop, error };
}
