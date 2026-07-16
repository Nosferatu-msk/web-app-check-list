import { useState, useEffect, useRef, useCallback } from 'react';

const AUTO_SAVE_INTERVAL = 30000; // 30 секунд

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSavedAt: Date | null;
  markDirty: () => void;
  resetDirty: () => void;
}

export function useAutoSave(
  saveFn: () => Promise<void>,
  deps: { enabled?: boolean; isSubmitting?: boolean } = {},
): UseAutoSaveReturn {
  const { enabled = true, isSubmitting = false } = deps;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const isDirtyRef = useRef(false);
  const isAutoSavingRef = useRef(false);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
  }, []);

  const resetDirty = useCallback(() => {
    isDirtyRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(async () => {
      if (
        !isDirtyRef.current ||
        isAutoSavingRef.current ||
        isSubmitting
      ) {
        return;
      }

      isAutoSavingRef.current = true;
      setIsSaving(true);

      try {
        await saveFnRef.current();
        isDirtyRef.current = false;
        setLastSavedAt(new Date());
      } catch {
        // Тихая ошибка — следующая попытка через 30 секунд
      } finally {
        isAutoSavingRef.current = false;
        setIsSaving(false);
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      clearInterval(interval);
      isAutoSavingRef.current = false;
    };
  }, [enabled, isSubmitting]);

  return { isSaving, lastSavedAt, markDirty, resetDirty };
}
