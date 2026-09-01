export type FieldType = 'select' | 'number' | 'text';

export interface FieldOption {
  label: string;
  value: string;
}

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  required?: boolean;
  defaultValue?: string;
  unit?: string;
}

const YES_NO: FieldOption[] = [
  { label: 'Да', value: 'Да' },
  { label: 'Нет', value: 'Нет' },
];

const SATISFACTORY: FieldOption[] = [
  { label: 'Удовлетворительно', value: 'Удовлетворительно' },
  { label: 'Неудовлетворительно', value: 'Неудовлетворительно' },
];

const CLEAN_DIRTY: FieldOption[] = [
  { label: 'Чистый', value: 'Чистый' },
  { label: 'Требует замены', value: 'Требует замены' },
];

const CLEAN_NEEDS: FieldOption[] = [
  { label: 'Чистый', value: 'Чистый' },
  { label: 'Необходима очистка', value: 'Необходима очистка' },
];

const ON_OFF: FieldOption[] = [
  { label: 'Включена', value: 'Включена' },
  { label: 'Выключена', value: 'Выключена' },
];

// 4.1 — РЩ/ГРЩ (rsch)
const RSCH_FIELDS: FormField[] = [
  { key: 'contact_connections', label: 'Состояние контактных соединений', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'neutral_conductor', label: 'Состояние нулевого проводника', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'grounding_circuit', label: 'Состояние заземляющего контура', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'wire_condition', label: 'Состояние проводов (оплавление, подгоревшая изоляция)', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'locking_devices', label: 'Исправность всех запирающих устройств', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'emergency_lighting', label: 'Исправность работы аварийного освещения', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'rcd_breakers', label: 'Исправность работы УЗО, автоматов диф.защиты', type: 'select', options: YES_NO, defaultValue: 'Да' },
];

// 4.2 — Прибор учета э/э (schetchik_electroshc)
const ELECTRO_METER_FIELDS: FormField[] = [
  { key: 'meter_model', label: 'Модель счётчика', type: 'text', required: true },
  { key: 'meter_number', label: 'Номер счётчика', type: 'text', required: true },
  { key: 'current_transformer', label: 'Трансформатор тока', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'readings', label: 'Показания', type: 'number', required: true },
];

// 4.3 — Вентиляционная установка (vent, teplozavesa, pritochnaya, pritochno-vytyzhnaya, vytyzhnaya)
const VENT_FIELDS: FormField[] = [
  { key: 'vent_present', label: 'Наличие вентиляционной установки', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'operating_mode', label: 'Режим работы', type: 'select', options: ON_OFF, defaultValue: 'Включена' },
  { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'noise_present', label: 'Наличие посторонних шумов', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: CLEAN_DIRTY, defaultValue: 'Чистый' },
  { key: 'temp_before', label: 'Температура воздуха до теплообменника', type: 'number', required: true, unit: '°C' },
  { key: 'temp_after', label: 'Температура воздуха после теплообменника', type: 'number', required: true, unit: '°C' },
];

// 4.4 — Внутренний блок СС (splitvn)
const SPLIT_INDOOR_FIELDS: FormField[] = [
  { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'noise_present', label: 'Наличие посторонних шумов', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'room_temp', label: 'Температура помещения на уровне 1,2м от пола', type: 'number', required: true, unit: '°C' },
  { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: CLEAN_NEEDS, defaultValue: 'Необходима очистка' },
  { key: 'drain_flush', label: 'Необходимость внеплановой промывки дренажной системы', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'refrigerant_leaks', label: 'Наличие утечек хладагента', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'cooling_capacity', label: 'Холодопроизводительность', type: 'number', required: true, unit: 'кВт' },
];

// 4.5 — Наружный блок СС (splitnar)
const SPLIT_OUTDOOR_FIELDS: FormField[] = [
  { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'outdoor_temperature', label: 'Температура наружного воздуха', type: 'number', required: true, unit: '°C' },
  { key: 'route_leaks', label: 'Наличие утечек на трассах', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'noise_present', label: 'Наличие посторонних шумов кондиционеров', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'block_flush', label: 'Необходимость внеплановой промывки наружного блока', type: 'select', options: YES_NO, defaultValue: 'Нет' },
];

// Мобильный кондиционер (cond_mobile)
const COND_MOBILE_FIELDS: FormField[] = [
  { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'noise_present', label: 'Наличие посторонних шумов', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'room_temp', label: 'Температура помещения', type: 'number', required: true, unit: '°C' },
  { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: CLEAN_NEEDS, defaultValue: 'Необходима очистка' },
  { key: 'drain_flush', label: 'Необходимость промывки дренажной системы', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'duct_condition', label: 'Состояние гофрированного воздуховода', type: 'select', options: [{ label: 'Целый, герметичный', value: 'Целый, герметичный' }, { label: 'Повреждён/негерметичен', value: 'Повреждён/негерметичен' }], defaultValue: 'Целый, герметичный' },
  { key: 'remote_control', label: 'Пульт ДУ исправен', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'cooling_capacity', label: 'Холодопроизводительность', type: 'number', required: true, unit: 'кВт' },
];

// ИТП (itp)
const ITP_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие ИТП', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'heat_exchangers', label: 'Состояние теплообменников', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'circulation_pumps', label: 'Циркуляционные насосы', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'safety_automation', label: 'Автоматика безопасности', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'filters_condition', label: 'Состояние фильтров/грязевиков', type: 'select', options: [{ label: 'Чистые', value: 'Чистые' }, { label: 'Требуют промывки', value: 'Требуют промывки' }], defaultValue: 'Чистые' },
  { key: 'system_pressure', label: 'Давление в системе', type: 'number', unit: 'бар' },
  { key: 'leaks', label: 'Протечки', type: 'select', options: YES_NO, defaultValue: 'Нет' },
];

// Котлы (gas/liquid/solid/elec) — идентичная форма
const BOILER_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие котла', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'heat_exchanger', label: 'Состояние теплообменника', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'combustion_chamber', label: 'Герметичность камеры сгорания', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'chimney_draft', label: 'Тяга в дымоходе', type: 'select', options: [{ label: 'Нормальная', value: 'Нормальная' }, { label: 'Слабая', value: 'Слабая' }, { label: 'Отсутствует', value: 'Отсутствует' }], defaultValue: 'Нормальная' },
  { key: 'safety_valves', label: 'Предохранительные клапаны', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'circulation_pumps', label: 'Циркуляционные насосы', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'system_pressure', label: 'Давление в системе', type: 'number', unit: 'бар' },
  { key: 'water_temperature', label: 'Температура теплоносителя', type: 'number', required: true, unit: '°C' },
];

// Прибор учёта газа (meter_gas)
const GAS_METER_FIELDS: FormField[] = [
  { key: 'meter_model', label: 'Модель счётчика', type: 'text', required: true },
  { key: 'meter_number', label: 'Номер счётчика', type: 'text', required: true },
  { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'readings', label: 'Показания', type: 'number', required: true },
  { key: 'body_integrity', label: 'Целостность корпуса', type: 'select', options: YES_NO, defaultValue: 'Да' },
];

// Сололифт (sololift)
const SOLOLIFT_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие сололифта', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'chamber_condition', label: 'Состояние внутренней камеры', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'check_valve', label: 'Обратный клапан', type: 'select', options: [{ label: 'Исправен', value: 'Исправен' }, { label: 'Требует очистки', value: 'Требует очистки' }], defaultValue: 'Исправен' },
  { key: 'float_sensor', label: 'Поплавковый датчик уровня', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'auto_start', label: 'Автоматическое включение', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'leaks', label: 'Протечки на патрубках', type: 'select', options: YES_NO, defaultValue: 'Нет' },
];

// Шлагбаум / Рольставни + Автодвери (barrier_roller, door_auto)
const BARRIER_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие оборудования', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'mechanism_condition', label: 'Состояние механизмов', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'photoelements', label: 'Фотоэлементы/датчики препятствий', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'manual_release', label: 'Ручной разблокировочный механизм', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'anchor_fastening', label: 'Крепление анкеров', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'gearbox_play', label: 'Люфт редуктора', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'lubrication', label: 'Смазка механизмов', type: 'select', options: [{ label: 'Достаточная', value: 'Достаточная' }, { label: 'Требуется смазка', value: 'Требуется смазка' }], defaultValue: 'Достаточная' },
];

// Кофе машина (coffee)
const COFFEE_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие кофемашины', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'brewing_unit', label: 'Состояние заварочного блока', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'descaling', label: 'Необходимость декальцинации', type: 'select', options: [{ label: 'Не требуется', value: 'Не требуется' }, { label: 'Требуется', value: 'Требуется' }], defaultValue: 'Не требуется' },
  { key: 'water_filters', label: 'Водяные фильтры', type: 'select', options: [{ label: 'Исправны', value: 'Исправны' }, { label: 'Требуют замены', value: 'Требуют замены' }], defaultValue: 'Исправны' },
  { key: 'cappuccinator', label: 'Капучинатор', type: 'select', options: [{ label: 'Чистый', value: 'Чистый' }, { label: 'Требует очистки', value: 'Требует очистки' }], defaultValue: 'Чистый' },
  { key: 'display_errors', label: 'Ошибки на дисплее', type: 'select', options: YES_NO, defaultValue: 'Нет' },
];

// Пурифаер (purifier)
const PURIFIER_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие пурифаера', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'pre_filter', label: 'Фильтр предварительной очистки', type: 'select', options: [{ label: 'Исправен', value: 'Исправен' }, { label: 'Требует замены', value: 'Требует замены' }], defaultValue: 'Исправен' },
  { key: 'hepa_filter', label: 'HEPA-фильтр', type: 'select', options: [{ label: 'Исправен', value: 'Исправен' }, { label: 'Требует замены', value: 'Требует замены' }], defaultValue: 'Исправен' },
  { key: 'air_quality_sensor', label: 'Датчик качества воздуха', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'fan_operation', label: 'Работа вентилятора', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
];

// Кулер (cooler)
const COOLER_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие кулера', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'hot_water_temp', label: 'Температура горячей воды', type: 'number', unit: '°C' },
  { key: 'cold_water_temp', label: 'Температура холодной воды', type: 'number', unit: '°C' },
  { key: 'tank_condition', label: 'Состояние баков', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: [{ label: 'Исправен', value: 'Исправен' }, { label: 'Требует замены', value: 'Требует замены' }], defaultValue: 'Исправен' },
];

// Аквариум / Пузырьковая панель (aquarium, bubble_panel)
const AQUARIUM_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'glass_condition', label: 'Состояние стёкол (чистота)', type: 'select', options: [{ label: 'Чистые', value: 'Чистые' }, { label: 'Требуют очистки', value: 'Требуют очистки' }], defaultValue: 'Чистые' },
  { key: 'compressor', label: 'Компрессор/аэратор', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'hose_integrity', label: 'Герметичность шлангов', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'water_condition', label: 'Состояние воды', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
];

// ДГУ (dgu)
const DGU_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие ДГУ', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'engine_condition', label: 'Состояние двигателя', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'oil_level', label: 'Уровень масла', type: 'select', options: [{ label: 'В норме', value: 'В норме' }, { label: 'Ниже нормы', value: 'Ниже нормы' }, { label: 'Требуется доливка', value: 'Требуется доливка' }], defaultValue: 'В норме' },
  { key: 'fuel_level', label: 'Уровень топлива', type: 'select', options: [{ label: 'Полный бак', value: 'Полный бак' }, { label: 'Средний', value: 'Средний' }, { label: 'Низкий', value: 'Низкий' }], defaultValue: 'Полный бак' },
  { key: 'air_filter', label: 'Состояние воздушного фильтра', type: 'select', options: CLEAN_DIRTY, defaultValue: 'Чистый' },
  { key: 'battery_condition', label: 'Состояние АКБ', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'manual_start', label: 'Ручной запуск исправен', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'runtime_hours', label: 'Наработка', type: 'number', unit: 'моточасов' },
];

// МКГУ (mkgu)
const MKGU_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие МКГУ', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'engine_condition', label: 'Состояние двигателя', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'oil_level', label: 'Уровень масла', type: 'select', options: [{ label: 'В норме', value: 'В норме' }, { label: 'Ниже нормы', value: 'Ниже нормы' }, { label: 'Требуется доливка', value: 'Требуется доливка' }], defaultValue: 'В норме' },
  { key: 'fuel_level', label: 'Уровень топлива', type: 'select', options: [{ label: 'Полный бак', value: 'Полный бак' }, { label: 'Средний', value: 'Средний' }, { label: 'Низкий', value: 'Низкий' }], defaultValue: 'Полный бак' },
  { key: 'air_filter', label: 'Состояние воздушного фильтра', type: 'select', options: CLEAN_DIRTY, defaultValue: 'Чистый' },
  { key: 'spark_plug', label: 'Состояние свечи зажигания', type: 'select', options: [{ label: 'Исправна', value: 'Исправна' }, { label: 'Требует замены', value: 'Требует замены' }], defaultValue: 'Исправна' },
  { key: 'manual_start', label: 'Ручной запуск исправен', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'runtime_hours', label: 'Наработка', type: 'number', unit: 'моточасов' },
];

// ИБП (ibp)
const IBP_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие ИБП', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'От сети', value: 'От сети' }, { label: 'От батарей', value: 'От батарей' }, { label: 'Байпас', value: 'Байпас' }], defaultValue: 'От сети' },
  { key: 'battery_capacity', label: 'Ёмкость батарей', type: 'number', required: true, unit: '%' },
  { key: 'battery_condition', label: 'Состояние батарей', type: 'select', options: [{ label: 'Без замечаний', value: 'Без замечаний' }, { label: 'Вздутие/дефекты', value: 'Вздутие/дефекты' }], defaultValue: 'Без замечаний' },
  { key: 'ventilation', label: 'Вентиляция в помещении', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'error_indicators', label: 'Индикаторы ошибок', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'room_temp', label: 'Температура в помещении', type: 'number', required: true, unit: '°C' },
];

// Лифты (lift_pass, lift_cargo, lift_cargo_pass)
const LIFT_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие оборудования', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'cabin_condition', label: 'Состояние кабины', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'door_mechanism', label: 'Механизм дверей', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'guide_rails', label: 'Состояние направляющих рельсов', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'emergency_phone', label: 'Телефон аварийной связи', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'lighting', label: 'Освещение кабины', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'floor_leveling', label: 'Точность остановки (выравнивание пола)', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'noise_present', label: 'Посторонние шумы при работе', type: 'select', options: YES_NO, defaultValue: 'Нет' },
];

// Подъёмные платформы для инвалидов (lift_invalid)
const LIFT_INVALID_FIELDS: FormField[] = [
  { key: 'unit_present', label: 'Наличие оборудования', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'platform_condition', label: 'Состояние платформы', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
  { key: 'limit_switches', label: 'Концевые выключатели', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'presence_sensors', label: 'Датчики присутствия', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'emergency_lowering', label: 'Механизм аварийного опускания', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'emergency_phone', label: 'Телефон аварийной связи', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'surface_condition', label: 'Состояние поверхности платформы', type: 'select', options: SATISFACTORY, defaultValue: 'Удовлетворительно' },
];

// 4.10 — Сети водоснабжения и водоотведения (seti_vodosnab)
const WATER_NETWORK_FIELDS: FormField[] = [
  { key: 'cold_water_damage', label: 'Наличие повреждений трубопровода ХВС', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'hot_water_damage', label: 'Наличие повреждений трубопровода ГВС', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'cold_water_corrosion', label: 'Наличие коррозии на трубопроводах ХВС', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'hot_water_corrosion', label: 'Наличие коррозии на трубопроводах ГВС', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'cold_water_leaks', label: 'Наличие свищей/протечек на трубопроводах ХВС', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'hot_water_leaks', label: 'Наличие свищей/протечек на трубопроводах ГВС', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'fastener_issues', label: 'Наличие неисправностей крепежей', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'cold_water_other', label: 'Наличие прочих неисправностей трубопроводов ХВС', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'hot_water_other', label: 'Наличие прочих неисправностей трубопроводов ГВС', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'valve_tightness', label: 'Герметичность запорной, защитной и регулирующей арматуры', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'drain_funnels', label: 'Сливные воронки, желоба, выпускные воронки', type: 'select', options: [{ label: 'Чистые', value: 'Чистые' }, { label: 'Необходима очистка', value: 'Необходима очистка' }], defaultValue: 'Чистые' },
];

// 4.11 — Прибор учета ХВС (schetchik_hvs)
const HVS_METER_FIELDS: FormField[] = [
  { key: 'meter_model', label: 'Модель счётчика', type: 'text', required: true },
  { key: 'meter_number', label: 'Номер счётчика', type: 'text', required: true },
  { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'readings', label: 'Показания', type: 'number', required: true },
];

// 4.12 — Прибор учета ГВС (schetchik_gvs) — аналогично ХВС
const GVS_METER_FIELDS: FormField[] = [
  { key: 'meter_model', label: 'Модель счётчика', type: 'text', required: true },
  { key: 'meter_number', label: 'Номер счётчика', type: 'text', required: true },
  { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'readings', label: 'Показания', type: 'number', required: true },
];

// 4.13 — Тепловые сети (teplovye_seti)
const HEATING_NETWORK_FIELDS: FormField[] = [
  { key: 'pipeline_damage', label: 'Наличие повреждений трубопровода теплоснабжения', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'corrosion', label: 'Наличие коррозии на трубопроводах', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'leaks', label: 'Наличие свищей/протечек на трубопроводах', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'fastener_issues', label: 'Наличие неисправностей крепежей', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'other_issues', label: 'Наличие прочих неисправностей трубопроводов', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'valve_tightness', label: 'Герметичность запорной, защитной и регулирующей арматуры', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'air_locks', label: 'Наличие завоздушивания системы', type: 'select', options: YES_NO, defaultValue: 'Нет' },
  { key: 'instruments_ok', label: 'Контрольно-измерительные приборы исправны', type: 'select', options: YES_NO, defaultValue: 'Да' },
  { key: 'heating_temp', label: 'Температуры приборов отопления', type: 'number', unit: '°C' },
];

// group_climate — групповая задача для внутренних блоков климата
const GROUP_CLIMATE_FIELDS: FormField[] = [
  { key: 'room_temp', label: 'Температура помещения на уровне 1,2м от пола', type: 'number', required: true, unit: '°C' },
];

// Маппинг кодов оборудования к формам
const FORM_MAP: Record<string, FormField[]> = {
  // Основные 13 типов
  rsch: RSCH_FIELDS,
  schetchik_electroshc: ELECTRO_METER_FIELDS,
  vent: VENT_FIELDS,
  teplozavesa: VENT_FIELDS,
  pritochnaya: VENT_FIELDS,
  'pritochno-vytyzhnaya': VENT_FIELDS,
  vytyzhnaya: VENT_FIELDS,
  splitvn: SPLIT_INDOOR_FIELDS,
  splitnar: SPLIT_OUTDOOR_FIELDS,
  mssvn: SPLIT_INDOOR_FIELDS,
  mssnar: SPLIT_OUTDOOR_FIELDS,
  vrv_vn: SPLIT_INDOOR_FIELDS,
  vrv_nar: SPLIT_OUTDOOR_FIELDS,
  seti_vodosnab: WATER_NETWORK_FIELDS,
  schetchik_hvs: HVS_METER_FIELDS,
  schetchik_gvs: GVS_METER_FIELDS,
  teplovye_seti: HEATING_NETWORK_FIELDS,
  group_climate: GROUP_CLIMATE_FIELDS,
  // Дополнительные типы (из PWA)
  cond_mobile: COND_MOBILE_FIELDS,
  itp: ITP_FIELDS,
  boiler_gas: BOILER_FIELDS,
  boiler_liquid: BOILER_FIELDS,
  boiler_solid: BOILER_FIELDS,
  boiler_elec: BOILER_FIELDS,
  meter_gas: GAS_METER_FIELDS,
  sololift: SOLOLIFT_FIELDS,
  barrier_roller: BARRIER_FIELDS,
  door_auto: BARRIER_FIELDS,
  coffee: COFFEE_FIELDS,
  purifier: PURIFIER_FIELDS,
  cooler: COOLER_FIELDS,
  aquarium: AQUARIUM_FIELDS,
  bubble_panel: AQUARIUM_FIELDS,
  dgu: DGU_FIELDS,
  mkgu: MKGU_FIELDS,
  ibp: IBP_FIELDS,
  lift_pass: LIFT_FIELDS,
  lift_cargo: LIFT_FIELDS,
  lift_cargo_pass: LIFT_FIELDS,
  lift_invalid: LIFT_INVALID_FIELDS,
};

// Группировка: внутренние блоки климата используют одну форму
const groupClimateIndoor = SPLIT_INDOOR_FIELDS;

export function getFormFields(equipmentTypeCode?: string): FormField[] {
  if (!equipmentTypeCode) return [];
  return FORM_MAP[equipmentTypeCode] || [];
}

export function getDefaultValues(fields: FormField[]): Record<string, any> {
  const defaults: Record<string, any> = {};
  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      defaults[field.key] = field.defaultValue;
    } else if (field.type === 'number') {
      defaults[field.key] = '';
    } else if (field.type === 'text') {
      defaults[field.key] = '';
    }
  }
  return defaults;
}
