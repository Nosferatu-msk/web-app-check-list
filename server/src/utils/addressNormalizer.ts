/**
 * Нормализация адреса для сравнения
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  
  let normalized = address
    // Удаление лишних пробелов
    .replace(/\s+/g, ' ')
    .trim()
    // Приведение к нижнему регистру
    .toLowerCase()
    // Удаление слов-паразитов
    .replace(/\b(россия|рф)\b/gi, '')
    // Удаление почтовых индексов
    .replace(/\b\d{6}\b/g, '')
    // Нормализация сокращений
    .replace(/\bг\.\s*/g, 'г ')
    .replace(/\bгород\s+/g, 'г ')
    .replace(/\bул\.\s*/g, 'ул ')
    .replace(/\bулица\s+/g, 'ул ')
    .replace(/\bпроспект\s+/g, 'пр-кт ')
    .replace(/\bпр-т\s+/g, 'пр-кт ')
    .replace(/\bд\.\s*/g, '')
    .replace(/\bдом\s+/g, '')
    .replace(/\bкорп\.?\s*/g, 'к')
    .replace(/\bкорпус\s+/g, 'к')
    .replace(/\bстр\.?\s*/g, 'стр')
    .replace(/\bстроение\s+/g, 'стр')
    .replace(/\bкв\.\s*/g, '')
    .replace(/\bквартира\s+/g, '')
    // Удаление точек после сокращений
    .replace(/\bг\s+/g, 'г ')
    .replace(/\bул\s+/g, 'ул ')
    // Удаление лишних пробелов после нормализации
    .replace(/\s+/g, ' ')
    .trim();
  
  return normalized;
}

/**
 * Проверка совпадения адресов с учётом нормализации
 */
export function addressesMatch(address1: string, address2: string): boolean {
  const norm1 = normalizeAddress(address1);
  const norm2 = normalizeAddress(address2);
  return norm1 === norm2;
}

/**
 * Формат кода объекта: RU/NN/NNN
 */
export function isValidObjectCode(code: string): boolean {
  return /^RU\/\d{2}\/\d+$/i.test(code);
}
