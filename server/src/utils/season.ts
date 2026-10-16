/**
 * Определение сезона по текущей дате (МСК).
 * Лето: апрель–сентябрь, Зима: октябрь–март.
 */
export function getCurrentSeason(): 'summer' | 'winter' {
  const msk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const month = msk.getMonth() + 1;
  return (month >= 4 && month <= 9) ? 'summer' : 'winter';
}

/**
 * Определение сезона по произвольной дате.
 */
export function getSeasonForDate(date: Date): 'summer' | 'winter' {
  const month = date.getMonth() + 1;
  return (month >= 4 && month <= 9) ? 'summer' : 'winter';
}

/**
 * Получить текущую дату-время в МСК.
 */
export function getMskNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
}

/**
 * Форматировать время МСК как HH:MM.
 */
export function getMskTime(): string {
  const now = getMskNow();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
