import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<any> | null = null;

/**
 * Получить fingerprint браузера (кэшируется для производительности)
 */
export async function getFingerprint(): Promise<string> {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  
  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
}

/**
 * Очистить кэш fingerprint (используется при logout)
 */
export function clearFingerprintCache(): void {
  fpPromise = null;
}
