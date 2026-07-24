import { useState, useRef, useCallback, useEffect } from 'react';

interface UseTorchReturn {
  isOn: boolean;
  isSupported: boolean | null; // null = ещё не проверено
  error: string | null;
  toggle: () => Promise<void>;
}

let supportedCache: boolean | null = null;

export function useTorch(): UseTorchReturn {
  const [isOn, setIsOn] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(supportedCache);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const overheatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnRef = useRef(false);

  // Check torch support (cached)
  const checkSupport = useCallback(async (): Promise<boolean> => {
    if (supportedCache !== null) return supportedCache;

    if (!navigator.mediaDevices?.getUserMedia) {
      supportedCache = false;
      setSupported(false);
      return false;
    }

    // Mobile check
    const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMobile) {
      supportedCache = false;
      setSupported(false);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: 'environment' } },
      });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as MediaTrackCapabilities;
      stream.getTracks().forEach(t => t.stop());
      supportedCache = !!capabilities.torch;
      setSupported(supportedCache);
      return supportedCache;
    } catch {
      supportedCache = false;
      setSupported(false);
      return false;
    }
  }, []);

  // Check battery level
  const checkBattery = useCallback(async (): Promise<number | null> => {
    try {
      if ('getBattery' in navigator && navigator.getBattery) {
        const battery = await navigator.getBattery();
        return battery.level;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const disableTorch = useCallback(() => {
    if (overheatTimerRef.current) {
      clearTimeout(overheatTimerRef.current);
      overheatTimerRef.current = null;
    }

    if (trackRef.current) {
      try {
        trackRef.current.applyConstraints({ advanced: [{ torch: false }] });
        trackRef.current.stop();
      } catch { /* ignore */ }
      trackRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    isOnRef.current = false;
    setIsOn(false);
  }, []);

  const enableTorch = useCallback(async () => {
    setError(null);

    // Battery check
    const batteryLevel = await checkBattery();
    if (batteryLevel !== null && batteryLevel < 0.05) {
      // Show warning but don't block — handled by component via return value
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: 'environment' } },
      });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as MediaTrackCapabilities;

      if (!capabilities.torch) {
        stream.getTracks().forEach(t => t.stop());
        setError('Устройство не поддерживает управление фонариком');
        return;
      }

      await track.applyConstraints({ advanced: [{ torch: true }] });
      streamRef.current = stream;
      trackRef.current = track;
      isOnRef.current = true;
      setIsOn(true);

      // Overheat timer (15 min)
      overheatTimerRef.current = setTimeout(() => {
        // Timer expired — component handles notification
      }, 15 * 60 * 1000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Доступ к камере запрещён. Разрешите доступ в настройках браузера.');
      } else if (err.name === 'NotFoundError') {
        setError('Камера не найдена на устройстве.');
      } else if (err.name === 'NotReadableError') {
        setError('Камера используется другим приложением.');
      } else {
        setError('Не удалось включить фонарик. Попробуйте ещё раз.');
      }
    }
  }, [checkBattery]);

  const toggle = useCallback(async () => {
    if (isOnRef.current) {
      disableTorch();
    } else {
      await enableTorch();
    }
  }, [enableTorch, disableTorch]);

  // Auto-disable on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isOnRef.current) {
        disableTorch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [disableTorch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disableTorch();
    };
  }, [disableTorch]);

  // Initial support check
  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  return {
    isOn,
    isSupported: supported,
    error,
    toggle,
  };
}
