import { useRef, useState, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  interimTranscript: string;
  newFinalText: string;
  startListening: () => void;
  stopListening: () => void;
  clearNewText: () => void;
  error: string | null;
}

const SILENCE_TIMEOUT_MS = 5000;

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [newFinalText, setNewFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedByUserRef = useRef(false);
  const lastResultCountRef = useRef(0);

  const SpeechRecognitionAPI = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  const isSupported = !!SpeechRecognitionAPI;

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (recognitionRef.current && !stoppedByUserRef.current) {
        recognitionRef.current.stop();
      }
    }, SILENCE_TIMEOUT_MS);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError('Голосовой ввод не поддерживается вашим браузером');
      return;
    }

    setError(null);
    setInterimTranscript('');
    setNewFinalText('');
    lastResultCountRef.current = 0;
    stoppedByUserRef.current = false;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      resetSilenceTimer();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer();

      let interim = '';
      let chunk = '';

      for (let i = lastResultCountRef.current; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          chunk += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      lastResultCountRef.current = event.results.length;

      if (chunk) {
        setNewFinalText(prev => prev + chunk);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted') return;

      const ERROR_MESSAGES: Record<string, string> = {
        'not-allowed': 'Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.',
        'no-speech': 'Речь не обнаружена. Попробуйте ещё раз.',
        'network': 'Ошибка сети. Проверьте подключение к интернету.',
        'audio-capture': 'Микрофон не найден.',
      };
      setError(ERROR_MESSAGES[event.error] || 'Не удалось распознать речь. Попробуйте ещё раз.');
      setIsListening(false);
      clearSilenceTimer();
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      clearSilenceTimer();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError('Не удалось запустить распознавание. Попробуйте ещё раз.');
    }
  }, [SpeechRecognitionAPI, resetSilenceTimer, clearSilenceTimer]);

  const stopListening = useCallback(() => {
    stoppedByUserRef.current = true;
    clearSilenceTimer();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  const clearNewText = useCallback(() => {
    setNewFinalText('');
  }, []);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, [clearSilenceTimer]);

  return {
    isListening,
    isSupported,
    interimTranscript,
    newFinalText,
    startListening,
    stopListening,
    clearNewText,
    error,
  };
}
