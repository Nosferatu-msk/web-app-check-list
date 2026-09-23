/**
 * Единая конфигурация обязательных параметров по типу оборудования.
 * Используется клиентом (валидация формы, завершение визита) и сервером (валидация при завершении, отчёты).
 */

export interface RequiredParam {
  key: string;
  type: 'text' | 'number';
  label: string;
}

/**
 * Обязательные параметры для каждого кода оборудования.
 * Если код отсутствует в этом словаре — у оборудования нет обязательных параметров.
 */
export const REQUIRED_PARAMS_CONFIG: Record<string, RequiredParam[]> = {
  // ─── Счётчики ───────────────────────────────────────────────
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

  // ─── Вентиляция и воздушное отопление ───────────────────────
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
  vytyzhnaya: [
    { key: 'temperature_before', type: 'number', label: 'Температура воздуха до теплообменника' },
    { key: 'temperature_after', type: 'number', label: 'Температура воздуха после теплообменника' },
  ],

  // ─── Климатическое оборудование (сплит-системы) ────────────
  splitvn: [
    { key: 'room_temperature', type: 'number', label: 'Температура помещения' },
    { key: 'cooling_capacity_kw', type: 'number', label: 'Холодопроизводительность, кВт' },
  ],
  splitnar: [
    { key: 'outdoor_temperature', type: 'number', label: 'Температура наружного воздуха' },
  ],
  mssvn: [
    { key: 'room_temperature', type: 'number', label: 'Температура помещения' },
    { key: 'cooling_capacity_kw', type: 'number', label: 'Холодопроизводительность, кВт' },
  ],
  mssnar: [
    { key: 'outdoor_temperature', type: 'number', label: 'Температура наружного воздуха' },
  ],
  vrv_vn: [
    { key: 'room_temperature', type: 'number', label: 'Температура помещения' },
    { key: 'cooling_capacity_kw', type: 'number', label: 'Холодопроизводительность, кВт' },
  ],
  vrv_nar: [
    { key: 'outdoor_temperature', type: 'number', label: 'Температура наружного воздуха' },
  ],

  // ─── Котлы ──────────────────────────────────────────────────
  kotyel: [
    { key: 'water_temperature', type: 'number', label: 'Температура теплоносителя' },
  ],
  boiler_gas: [
    { key: 'water_temperature', type: 'number', label: 'Температура теплоносителя' },
  ],
  boiler_liquid: [
    { key: 'water_temperature', type: 'number', label: 'Температура теплоносителя' },
  ],
  boiler_solid: [
    { key: 'water_temperature', type: 'number', label: 'Температура теплоносителя' },
  ],
  boiler_elec: [
    { key: 'water_temperature', type: 'number', label: 'Температура теплоносителя' },
  ],

  // ─── Мобильный кондиционер ─────────────────────────────────
  cond_mobile: [
    { key: 'room_temperature', type: 'number', label: 'Температура помещения' },
    { key: 'cooling_capacity_kw', type: 'number', label: 'Холодопроизводительность, кВт' },
  ],

  // ─── ИБП ────────────────────────────────────────────────────
  ibp: [
    { key: 'battery_capacity', type: 'number', label: 'Ёмкость батарей (%)' },
    { key: 'temperature', type: 'number', label: 'Температура в помещении' },
  ],
};

/**
 * Получить обязательные параметры для кода оборудования.
 */
export function getRequiredParams(equipmentCode: string): RequiredParam[] {
  return REQUIRED_PARAMS_CONFIG[equipmentCode] || [];
}

/**
 * Получить все коды оборудования, у которых есть обязательные параметры.
 */
export function getAllRequiredEquipmentCodes(): string[] {
  return Object.keys(REQUIRED_PARAMS_CONFIG);
}
