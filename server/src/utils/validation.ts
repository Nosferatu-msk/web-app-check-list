/**
 * Валидация данных задач — обязательные поля, антифрод, нормализация показаний.
 */

// ─── Антифрод: осмысленность текста ─────────────────────────

/**
 * Проверяет, что текст содержит осмысленные данные (не мусор).
 * Отклоняет: пустые строки, только пробелы/спецсимволы, повторяющиеся символы ("...."),
 * текст начинающийся со спецсимвола или пробела.
 */
export function isMeaningfulText(value: unknown, minLength = 2): boolean {
  if (value === undefined || value === null) return false;
  const str = String(value);
  const trimmed = str.trim();
  if (trimmed.length < minLength) return false;
  if (/^(.)\1+$/.test(trimmed)) return false;
  if (/^[^\p{L}\p{N}]+$/u.test(trimmed)) return false;
  return true;
}

/**
 * Проверяет, что текст не начинается со спецсимвола или пробела.
 */
export function startsWithValidChar(value: unknown): boolean {
  if (!value) return false;
  const str = String(value).trim();
  if (str.length === 0) return false;
  return /^[\p{L}\p{N}]/u.test(str);
}

// ─── Показания и числовая валидация ─────────────────────────

/**
 * Валидирует и нормализует показания счётчика.
 * - Целая часть: до 9 цифр, не начинается с 0 (кроме "0" и "0.X")
 * - Дробная часть: до 4 цифр (необязательна)
 * - Разделитель: "." или ","
 * - Возвращает нормализованное число (запятая → точка) или null при ошибке
 */
export function validateAndNormalizeReadings(value: unknown): { valid: boolean; value?: number; error?: string } {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: 'Показания не заполнены' };
  }

  const str = String(value).trim().replace(',', '.');

  if (str === '' || str === '.' || str === '-') {
    return { valid: false, error: 'Показания не заполнены' };
  }

  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    return { valid: false, error: 'Показания должны быть числом' };
  }

  const negative = str.startsWith('-');
  const absStr = negative ? str.slice(1) : str;
  const parts = absStr.split('.');
  const intPart = parts[0];
  const fracPart = parts[1];

  if (intPart.length > 1 && intPart.startsWith('0')) {
    return { valid: false, error: 'Число не может начинаться с 0' };
  }

  if (intPart.length > 9) {
    return { valid: false, error: 'Целая часть не может быть более 9 цифр' };
  }

  if (fracPart !== undefined && fracPart.length > 4) {
    return { valid: false, error: 'Дробная часть не может быть более 4 цифр' };
  }

  const num = parseFloat(str);
  if (isNaN(num)) {
    return { valid: false, error: 'Показания должны быть числом' };
  }

  return { valid: true, value: num };
}

/**
 * Валидирует числовое поле параметра (температура, давление и т.д.).
 */
export function validateNumberParam(value: unknown, label: string): { valid: boolean; value?: number; error?: string } {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: `${label}: не заполнено` };
  }

  const str = String(value).trim().replace(',', '.');
  const num = parseFloat(str);

  if (isNaN(num)) {
    return { valid: false, error: `${label}: должно быть числом` };
  }

  return { valid: true, value: num };
}

// ─── Конфигурация обязательных параметров по типу оборудования ─

interface RequiredParam {
  key: string;
  type: 'text' | 'number';
  label: string;
}

const REQUIRED_PARAMS: Record<string, RequiredParam[]> = {
  schetchik_electroshc: [
    { key: 'model', type: 'text', label: 'Модель счётчика' },
    { key: 'serial_number', type: 'text', label: 'Номер счётчика' },
    { key: 'readings', type: 'number', label: 'Показания' },
  ],
  schetchik_hvs: [
    { key: 'model', type: 'text', label: 'Модель счётчика' },
    { key: 'serial_number', type: 'text', label: 'Номер счётчика' },
    { key: 'readings', type: 'number', label: 'Показания' },
  ],
  schetchik_gvs: [
    { key: 'model', type: 'text', label: 'Модель счётчика' },
    { key: 'serial_number', type: 'text', label: 'Номер счётчика' },
    { key: 'readings', type: 'number', label: 'Показания' },
  ],
  meter_gas: [
    { key: 'model', type: 'text', label: 'Модель счётчика' },
    { key: 'serial_number', type: 'text', label: 'Номер счётчика' },
    { key: 'readings', type: 'number', label: 'Показания' },
  ],
  vent: [
    { key: 'temperature_before', type: 'number', label: 'Температура воздуха до теплообменника' },
    { key: 'temperature_after', type: 'number', label: 'Температура воздуха после теплообменника' },
  ],
  teplozavesa: [
    { key: 'temperature_before', type: 'number', label: 'Температура воздуха до теплообменника' },
    { key: 'temperature_after', type: 'number', label: 'Температура воздуха после теплообменника' },
  ],
  pritochnaya: [
    { key: 'temperature_before', type: 'number', label: 'Температура воздуха до теплообменника' },
    { key: 'temperature_after', type: 'number', label: 'Температура воздуха после теплообменника' },
  ],
  'pritochno-vytyzhnaya': [
    { key: 'temperature_before', type: 'number', label: 'Температура воздуха до теплообменника' },
    { key: 'temperature_after', type: 'number', label: 'Температура воздуха после теплообменника' },
  ],
  kotyel: [
    { key: 'water_temperature', type: 'number', label: 'Температура теплоносителя' },
  ],
  cond_mobile: [
    { key: 'room_temperature', type: 'number', label: 'Температура помещения' },
  ],
};

export function getRequiredParams(equipmentCode: string): RequiredParam[] {
  return REQUIRED_PARAMS[equipmentCode] || [];
}

// ─── Комплексная валидация задачи ────────────────────────────

export interface TaskValidationError {
  field: string;
  message: string;
}

/**
 * Проверяет параметры задачи на заполненность и корректность.
 * Возвращает массив ошибок (пустой если всё ок).
 */
export function validateTaskParameters(
  parameters: Record<string, any> | null | undefined,
  equipmentCode: string,
): TaskValidationError[] {
  const errors: TaskValidationError[] = [];
  const requiredParams = getRequiredParams(equipmentCode);
  const params = parameters || {};

  for (const param of requiredParams) {
    const value = params[param.key];

    if (param.type === 'text') {
      if (!isMeaningfulText(value)) {
        errors.push({ field: param.key, message: `${param.label}: не заполнено или содержит некорректные данные` });
      } else if (!startsWithValidChar(value)) {
        errors.push({ field: param.key, message: `${param.label}: не может начинаться со спецсимвола или пробела` });
      }
    } else if (param.type === 'number') {
      const result = validateNumberParam(value, param.label);
      if (!result.valid) {
        errors.push({ field: param.key, message: result.error! });
      }
    }
  }

  return errors;
}

/**
 * Проверяет текстовые поля задачи (brand, model, serialNumber) на корректность.
 */
export function validateTaskFields(fields: {
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
}): TaskValidationError[] {
  const errors: TaskValidationError[] = [];

  if (fields.brand && !startsWithValidChar(fields.brand)) {
    errors.push({ field: 'brand', message: 'Изготовитель: не может начинаться со спецсимвола или пробела' });
  }
  if (fields.model && !startsWithValidChar(fields.model)) {
    errors.push({ field: 'model', message: 'Модель: не может начинаться со спецсимвола или пробела' });
  }
  if (fields.serialNumber && !startsWithValidChar(fields.serialNumber)) {
    errors.push({ field: 'serialNumber', message: 'Серийный номер: не может начинаться со спецсимвола или пробела' });
  }

  return errors;
}

/**
 * Нормализует числовые значения в parameters (запятая → точка).
 * Возвращает новый объект parameters с нормализованными значениями.
 */
export function normalizeNumericParams(
  parameters: Record<string, any>,
  equipmentCode: string,
): Record<string, any> {
  const requiredParams = getRequiredParams(equipmentCode);
  const normalized = { ...parameters };

  for (const param of requiredParams) {
    if (param.type === 'number' && normalized[param.key] !== undefined && normalized[param.key] !== null) {
      const str = String(normalized[param.key]).trim().replace(',', '.');
      const num = parseFloat(str);
      if (!isNaN(num)) {
        normalized[param.key] = num;
      }
    }
  }

  return normalized;
}
