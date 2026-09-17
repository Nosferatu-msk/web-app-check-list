/**
 * Захват GPS-координат с таймаутом.
 * Возвращает null если GPS недоступен или истёк таймаут.
 */
export async function capturePosition(timeoutMs = 5000): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}
