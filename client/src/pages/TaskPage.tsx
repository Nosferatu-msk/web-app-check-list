import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Form, Select, Input, Button, Checkbox, Space, App, Spin, Card, Popconfirm, Tooltip } from 'antd';
import { ArrowLeftOutlined, CameraOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useAutoSave } from '../hooks/useAutoSave';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const { TextArea } = Input;

const CONCLUSION_OPTIONS = [
  { label: 'Исправно, замечаний нет', value: 'ok' },
  { label: 'Исправно, есть замечания', value: 'ok_with_notes' },
  { label: 'Неисправно', value: 'faulty' },
];

const BOOL_OPTIONS = [
  { label: 'Да', value: true },
  { label: 'Нет', value: false },
];

const SATISFACTORY_OPTIONS = [
  { label: 'Удовлетворительно', value: 'satisfactory' },
  { label: 'Неудовлетворительно', value: 'unsatisfactory' },
];

// Parameter definitions per equipment type
const PARAM_CONFIG: Record<string, { key: string; label: string; type: 'select' | 'number' | 'text'; options?: any[]; required?: boolean; defaultValue?: any }[]> = {
  rsch: [
    { key: 'contact_connections', label: 'Состояние контактных соединений', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'neutral_conductor', label: 'Состояние нулевого проводника', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'grounding_circuit', label: 'Состояние заземляющего контура', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'wire_condition', label: 'Состояние проводов (оплавление, подгоревшая изоляция)', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'locking_devices', label: 'Исправность всех запирающих устройств', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'emergency_lighting', label: 'Исправность работы аварийного освещения', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'rcd_breakers', label: 'Исправность работы УЗО, автоматов диф.защиты', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
  ],
  schetchik_electroshc: [
    { key: 'model', label: 'Модель счётчика', type: 'text', required: true },
    { key: 'serial_number', label: 'Номер счётчика', type: 'text', required: true },
    { key: 'current_transformer', label: 'Трансформатор тока', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'readings', label: 'Показания', type: 'number', required: true },
  ],
  vent: [
    { key: 'unit_present', label: 'Наличие вентиляционной установки', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'Включена', value: 'on' }, { label: 'Выключена', value: 'off' }], defaultValue: 'on' },
    { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'temperature_before', label: 'Температура воздуха до теплообменника, °C', type: 'number', required: true },
    { key: 'temperature_after', label: 'Температура воздуха после теплообменника, °C', type: 'number', required: true },
  ],
  teplozavesa: [
    { key: 'unit_present', label: 'Наличие тепловой завесы', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'Включена', value: 'on' }, { label: 'Выключена', value: 'off' }], defaultValue: 'on' },
    { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'temperature_before', label: 'Температура воздуха до теплообменника, °C', type: 'number', required: true },
    { key: 'temperature_after', label: 'Температура воздуха после теплообменника, °C', type: 'number', required: true },
  ],
  pritochnaya: [
    { key: 'unit_present', label: 'Наличие приточной установки', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'Включена', value: 'on' }, { label: 'Выключена', value: 'off' }], defaultValue: 'on' },
    { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'temperature_before', label: 'Температура воздуха до теплообменника, °C', type: 'number', required: true },
    { key: 'temperature_after', label: 'Температура воздуха после теплообменника, °C', type: 'number', required: true },
  ],
  'pritochno-vytyzhnaya': [
    { key: 'unit_present', label: 'Наличие приточно-вытяжной установки', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'Включена', value: 'on' }, { label: 'Выключена', value: 'off' }], defaultValue: 'on' },
    { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'temperature_before', label: 'Температура воздуха до теплообменника, °C', type: 'number', required: true },
    { key: 'temperature_after', label: 'Температура воздуха после теплообменника, °C', type: 'number', required: true },
  ],
  vytyzhnaya: [
    { key: 'unit_present', label: 'Наличие вытяжной установки', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'Включена', value: 'on' }, { label: 'Выключена', value: 'off' }], defaultValue: 'on' },
    { key: 'controller_errors', label: 'Наличие аварий и ошибок контроллера', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'filter_condition', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'temperature_before', label: 'Температура воздуха до теплообменника, °C', type: 'number', required: true },
    { key: 'temperature_after', label: 'Температура воздуха после теплообменника, °C', type: 'number', required: true },
  ],
  splitvn: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'room_temperature', label: 'Температура помещения на уровне 1,2м от пола, °C', type: 'number', required: true },
    { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Необходима очистка', value: 'needs_cleaning' }], defaultValue: 'needs_cleaning' },
    { key: 'drain_flush_needed', label: 'Необходимость внеплановой промывки дренажной системы', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'refrigerant_leaks', label: 'Наличие утечек хладагента', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'cooling_capacity_kw', label: 'Холодопроизводительность, кВт', type: 'number', required: true },
  ],
  splitnar: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'line_leaks', label: 'Наличие утечек на трассах', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов кондиционеров', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'unit_flush_needed', label: 'Необходимость внеплановой промывки наружного блока', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  mssvn: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'room_temperature', label: 'Температура помещения на уровне 1,2м от пола, °C', type: 'number', required: true },
    { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Необходима очистка', value: 'needs_cleaning' }], defaultValue: 'needs_cleaning' },
    { key: 'drain_flush_needed', label: 'Необходимость внеплановой промывки дренажной системы', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'refrigerant_leaks', label: 'Наличие утечек хладагента', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'cooling_capacity_kw', label: 'Холодопроизводительность, кВт', type: 'number', required: true },
  ],
  mssnar: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'line_leaks', label: 'Наличие утечек на трассах', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'unit_flush_needed', label: 'Необходимость внеплановой промывки наружного блока', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  vrv_vn: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'room_temperature', label: 'Температура помещения на уровне 1,2м от пола, °C', type: 'number', required: true },
    { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Необходима очистка', value: 'needs_cleaning' }], defaultValue: 'needs_cleaning' },
    { key: 'drain_flush_needed', label: 'Необходимость внеплановой промывки дренажной системы', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'refrigerant_leaks', label: 'Наличие утечек хладагента', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'cooling_capacity_kw', label: 'Холодопроизводительность, кВт', type: 'number', required: true },
  ],
  vrv_nar: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'line_leaks', label: 'Наличие утечек на трассах', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'unit_flush_needed', label: 'Необходимость внеплановой промывки наружного блока', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  seti_vodosnab: [
    { key: 'hvs_pipe_damage', label: 'Наличие повреждений трубопровода ХВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hws_pipe_damage', label: 'Наличие повреждений трубопровода ГВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hvs_corrosion', label: 'Наличие коррозии на трубопроводах ХВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hws_corrosion', label: 'Наличие коррозии на трубопроводах ГВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hvs_leaks', label: 'Наличие свищей/протечек на трубопроводах ХВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hws_leaks', label: 'Наличие свищей/протечек на трубопроводах ГВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'fastener_issues', label: 'Наличие неисправностей крепежей', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hvs_other_issues', label: 'Наличие прочих неисправностей трубопроводов ХВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'hws_other_issues', label: 'Наличие прочих неисправностей трубопроводов ГВС', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'valve_tightness', label: 'Герметичность запорной, защитной и регулирующей арматуры', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'drain_condition', label: 'Сливные воронки, желоба, выпускные воронки', type: 'select', options: [{ label: 'Чистые', value: 'clean' }, { label: 'Необходима очистка', value: 'needs_cleaning' }], defaultValue: 'clean' },
  ],
  schetchik_hvs: [
    { key: 'model', label: 'Модель счётчика', type: 'text', required: true },
    { key: 'serial_number', label: 'Номер счётчика', type: 'text', required: true },
    { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'readings', label: 'Показания', type: 'number', required: true },
  ],
  schetchik_gvs: [
    { key: 'model', label: 'Модель счётчика', type: 'text', required: true },
    { key: 'serial_number', label: 'Номер счётчика', type: 'text', required: true },
    { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'readings', label: 'Показания', type: 'number', required: true },
  ],
  teplovye_seti: [
    { key: 'pipe_damage', label: 'Наличие повреждений трубопровода теплоснабжения', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'corrosion', label: 'Наличие коррозии на трубопроводах', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'leaks', label: 'Наличие свищей/протечек на трубопроводах', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'fastener_issues', label: 'Наличие неисправностей крепежей', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'other_issues', label: 'Наличие прочих неисправностей трубопроводов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'valve_tightness', label: 'Герметичность запорной, защитной и регулирующей арматуры', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'air_locks', label: 'Наличие завоздушивания системы', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'instruments_ok', label: 'Контрольно-измерительные приборы исправны', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'heating_temperature', label: 'Температуры приборов отопления, °C', type: 'number' },
  ],
  dgu: [
    { key: 'unit_present', label: 'Наличие ДГУ', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'engine_condition', label: 'Состояние двигателя (визуальный осмотр)', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'oil_level', label: 'Уровень масла', type: 'select', options: [{ label: 'В норме', value: 'normal' }, { label: 'Ниже нормы', value: 'below_normal' }, { label: 'Требуется доливка', value: 'needs_topup' }], defaultValue: 'normal' },
    { key: 'fuel_level', label: 'Уровень топлива', type: 'select', options: [{ label: 'Полный бак', value: 'full' }, { label: 'Средний уровень', value: 'medium' }, { label: 'Низкий уровень', value: 'low' }], defaultValue: 'full' },
    { key: 'air_filter', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'battery_condition', label: 'Состояние АКБ', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'manual_start', label: 'Ручной запуск исправен', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'runtime_hours', label: 'Наработка, моточасы', type: 'number' },
  ],
  mkgu: [
    { key: 'unit_present', label: 'Наличие МКГУ', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'engine_condition', label: 'Состояние двигателя', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'oil_level', label: 'Уровень масла', type: 'select', options: [{ label: 'В норме', value: 'normal' }, { label: 'Ниже нормы', value: 'below_normal' }, { label: 'Требуется доливка', value: 'needs_topup' }], defaultValue: 'normal' },
    { key: 'fuel_level', label: 'Уровень топлива', type: 'select', options: [{ label: 'Полный бак', value: 'full' }, { label: 'Средний уровень', value: 'medium' }, { label: 'Низкий уровень', value: 'low' }], defaultValue: 'full' },
    { key: 'air_filter', label: 'Состояние воздушного фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'clean' },
    { key: 'spark_plug', label: 'Состояние свечи зажигания', type: 'select', options: [{ label: 'Исправна', value: 'ok' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'ok' },
    { key: 'manual_start', label: 'Ручной запуск исправен', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'runtime_hours', label: 'Наработка, моточасы', type: 'number' },
  ],
  ibp: [
    { key: 'unit_present', label: 'Наличие ИБП', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'operating_mode', label: 'Режим работы', type: 'select', options: [{ label: 'От сети', value: 'mains' }, { label: 'От батарей', value: 'battery' }, { label: 'Байпас', value: 'bypass' }], defaultValue: 'mains' },
    { key: 'battery_capacity', label: 'Ёмкость батарей (%)', type: 'number', required: true },
    { key: 'battery_condition', label: 'Состояние батарей (внешний осмотр)', type: 'select', options: [{ label: 'Без замечаний', value: 'ok' }, { label: 'Вздутие/дефекты', value: 'defective' }], defaultValue: 'ok' },
    { key: 'ventilation', label: 'Вентиляция в помещении', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'error_indicators', label: 'Индикаторы ошибок', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'temperature', label: 'Температура в помещении, °C', type: 'number', required: true },
  ],
  lift_pass: [
    { key: 'unit_present', label: 'Наличие оборудования', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'cabin_condition', label: 'Состояние кабины', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'door_mechanism', label: 'Механизм дверей', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'guide_rails', label: 'Состояние направляющих рельсов', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'emergency_phone', label: 'Телефон аварийной связи', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'lighting', label: 'Освещение кабины', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'floor_leveling', label: 'Точность остановки (выравнивание пола)', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'extraneous_noise', label: 'Посторонние шумы при работе', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  lift_cargo: [
    { key: 'unit_present', label: 'Наличие оборудования', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'cabin_condition', label: 'Состояние кабины', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'door_mechanism', label: 'Механизм дверей', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'guide_rails', label: 'Состояние направляющих рельсов', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'emergency_phone', label: 'Телефон аварийной связи', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'lighting', label: 'Освещение кабины', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'floor_leveling', label: 'Точность остановки (выравнивание пола)', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'extraneous_noise', label: 'Посторонние шумы при работе', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  lift_cargo_pass: [
    { key: 'unit_present', label: 'Наличие оборудования', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'cabin_condition', label: 'Состояние кабины', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'door_mechanism', label: 'Механизм дверей', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'guide_rails', label: 'Состояние направляющих рельсов', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'emergency_phone', label: 'Телефон аварийной связи', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'lighting', label: 'Освещение кабины', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'floor_leveling', label: 'Точность остановки (выравнивание пола)', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'extraneous_noise', label: 'Посторонние шумы при работе', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  lift_invalid: [
    { key: 'unit_present', label: 'Наличие оборудования', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'platform_condition', label: 'Состояние платформы', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'limit_switches', label: 'Концевые выключатели', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'presence_sensors', label: 'Датчики присутствия', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'emergency_lowering', label: 'Механизм аварийного опускания', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'emergency_phone', label: 'Телефон аварийной связи', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'surface_condition', label: 'Состояние поверхности платформы (антискользящее покрытие)', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
  ],
  itp: [
    { key: 'unit_present', label: 'Наличие ИТП', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'heat_exchangers', label: 'Состояние теплообменников', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'circulation_pumps', label: 'Циркуляционные насосы', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'safety_automation', label: 'Автоматика безопасности', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'filters_condition', label: 'Состояние фильтров/грязевиков', type: 'select', options: [{ label: 'Чистые', value: 'clean' }, { label: 'Требуют промывки', value: 'needs_cleaning' }], defaultValue: 'clean' },
    { key: 'system_pressure', label: 'Давление в системе, бар', type: 'number' },
    { key: 'leaks', label: 'Протечки', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  boiler_gas: [
    { key: 'unit_present', label: 'Наличие котла', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'heat_exchanger', label: 'Состояние теплообменника', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'combustion_chamber', label: 'Герметичность камеры сгорания', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'chimney_draft', label: 'Тяга в дымоходе', type: 'select', options: [{ label: 'Нормальная', value: 'normal' }, { label: 'Слабая', value: 'weak' }, { label: 'Отсутствует', value: 'none' }], defaultValue: 'normal' },
    { key: 'safety_valves', label: 'Предохранительные клапаны', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'circulation_pumps', label: 'Циркуляционные насосы', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'system_pressure', label: 'Давление в системе, бар', type: 'number' },
    { key: 'water_temperature', label: 'Температура теплоносителя, °C', type: 'number', required: true },
  ],
  boiler_liquid: [
    { key: 'unit_present', label: 'Наличие котла', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'heat_exchanger', label: 'Состояние теплообменника', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'combustion_chamber', label: 'Герметичность камеры сгорания', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'chimney_draft', label: 'Тяга в дымоходе', type: 'select', options: [{ label: 'Нормальная', value: 'normal' }, { label: 'Слабая', value: 'weak' }, { label: 'Отсутствует', value: 'none' }], defaultValue: 'normal' },
    { key: 'safety_valves', label: 'Предохранительные клапаны', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'circulation_pumps', label: 'Циркуляционные насосы', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'system_pressure', label: 'Давление в системе, бар', type: 'number' },
    { key: 'water_temperature', label: 'Температура теплоносителя, °C', type: 'number', required: true },
  ],
  boiler_solid: [
    { key: 'unit_present', label: 'Наличие котла', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'heat_exchanger', label: 'Состояние теплообменника', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'combustion_chamber', label: 'Герметичность камеры сгорания', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'chimney_draft', label: 'Тяга в дымоходе', type: 'select', options: [{ label: 'Нормальная', value: 'normal' }, { label: 'Слабая', value: 'weak' }, { label: 'Отсутствует', value: 'none' }], defaultValue: 'normal' },
    { key: 'safety_valves', label: 'Предохранительные клапаны', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'circulation_pumps', label: 'Циркуляционные насосы', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'system_pressure', label: 'Давление в системе, бар', type: 'number' },
    { key: 'water_temperature', label: 'Температура теплоносителя, °C', type: 'number', required: true },
  ],
  boiler_elec: [
    { key: 'unit_present', label: 'Наличие котла', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'heat_exchanger', label: 'Состояние теплообменника', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'combustion_chamber', label: 'Герметичность камеры сгорания', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'chimney_draft', label: 'Тяга в дымоходе', type: 'select', options: [{ label: 'Нормальная', value: 'normal' }, { label: 'Слабая', value: 'weak' }, { label: 'Отсутствует', value: 'none' }], defaultValue: 'normal' },
    { key: 'safety_valves', label: 'Предохранительные клапаны', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'circulation_pumps', label: 'Циркуляционные насосы', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'system_pressure', label: 'Давление в системе, бар', type: 'number' },
    { key: 'water_temperature', label: 'Температура теплоносителя, °C', type: 'number', required: true },
  ],
  meter_gas: [
    { key: 'model', label: 'Модель счётчика', type: 'text', required: true },
    { key: 'serial_number', label: 'Номер счётчика', type: 'text', required: true },
    { key: 'seal_present', label: 'Наличие пломбы', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'readings', label: 'Показания', type: 'number', required: true },
    { key: 'body_integrity', label: 'Целостность корпуса', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
  ],
  sololift: [
    { key: 'unit_present', label: 'Наличие сололифта', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'chamber_condition', label: 'Состояние внутренней камеры', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'check_valve', label: 'Обратный клапан', type: 'select', options: [{ label: 'Исправен', value: 'ok' }, { label: 'Требует очистки', value: 'needs_cleaning' }], defaultValue: 'ok' },
    { key: 'float_sensor', label: 'Поплавковый датчик уровня', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'auto_start', label: 'Автоматическое включение', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'leaks', label: 'Протечки на патрубках', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  cond_mobile: [
    { key: 'operability', label: 'Работоспособность', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'extraneous_noise', label: 'Наличие посторонних шумов', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'room_temperature', label: 'Температура помещения, °C', type: 'number', required: true },
    { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Необходима очистка', value: 'needs_cleaning' }], defaultValue: 'needs_cleaning' },
    { key: 'drain_flush_needed', label: 'Необходимость промывки дренажной системы', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'duct_condition', label: 'Состояние гофрированного воздуховода', type: 'select', options: [{ label: 'Целый, герметичный', value: 'ok' }, { label: 'Повреждён/негерметичен', value: 'damaged' }], defaultValue: 'ok' },
    { key: 'remote_control', label: 'Пульт ДУ исправен', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'cooling_capacity_kw', label: 'Холодопроизводительность, кВт', type: 'number', required: true },
  ],
  barrier_roller: [
    { key: 'unit_present', label: 'Наличие оборудования', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'mechanism_condition', label: 'Состояние механизмов', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'photoelements', label: 'Фотоэлементы/датчики препятствий', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'manual_release', label: 'Ручной разблокировочный механизм', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'anchor_fastening', label: 'Крепление анкеров', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'gearbox_play', label: 'Люфт редуктора', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'lubrication', label: 'Смазка механизмов', type: 'select', options: [{ label: 'Достаточная', value: 'sufficient' }, { label: 'Требуется смазка', value: 'needs_lubrication' }], defaultValue: 'sufficient' },
  ],
  door_auto: [
    { key: 'unit_present', label: 'Наличие оборудования', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'mechanism_condition', label: 'Состояние механизмов', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'photoelements', label: 'Фотоэлементы/датчики препятствий', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'manual_release', label: 'Ручной разблокировочный механизм', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'anchor_fastening', label: 'Крепление анкеров', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'gearbox_play', label: 'Люфт редуктора', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
    { key: 'lubrication', label: 'Смазка механизмов', type: 'select', options: [{ label: 'Достаточная', value: 'sufficient' }, { label: 'Требуется смазка', value: 'needs_lubrication' }], defaultValue: 'sufficient' },
  ],
  coffee: [
    { key: 'unit_present', label: 'Наличие кофемашины', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'brewing_unit', label: 'Состояние заварочного блока', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'descaling', label: 'Необходимость декальцинации', type: 'select', options: [{ label: 'Не требуется', value: 'ok' }, { label: 'Требуется', value: 'needed' }], defaultValue: 'ok' },
    { key: 'water_filters', label: 'Водяные фильтры', type: 'select', options: [{ label: 'Исправны', value: 'ok' }, { label: 'Требуют замены', value: 'needs_replacement' }], defaultValue: 'ok' },
    { key: 'cappuccinator', label: 'Капучинатор', type: 'select', options: [{ label: 'Чистый', value: 'clean' }, { label: 'Требует очистки', value: 'needs_cleaning' }], defaultValue: 'clean' },
    { key: 'display_errors', label: 'Ошибки на дисплее', type: 'select', options: BOOL_OPTIONS, defaultValue: false },
  ],
  purifier: [
    { key: 'unit_present', label: 'Наличие пурифаера', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'pre_filter', label: 'Фильтр предварительной очистки', type: 'select', options: [{ label: 'Исправен', value: 'ok' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'ok' },
    { key: 'hepa_filter', label: 'HEPA-фильтр', type: 'select', options: [{ label: 'Исправен', value: 'ok' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'ok' },
    { key: 'air_quality_sensor', label: 'Датчик качества воздуха', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'fan_operation', label: 'Работа вентилятора', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
  ],
  cooler: [
    { key: 'unit_present', label: 'Наличие кулера', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'hot_water_temp', label: 'Температура горячей воды, °C', type: 'number' },
    { key: 'cold_water_temp', label: 'Температура холодной воды, °C', type: 'number' },
    { key: 'tank_condition', label: 'Состояние баков', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
    { key: 'filter_condition', label: 'Состояние фильтра', type: 'select', options: [{ label: 'Исправен', value: 'ok' }, { label: 'Требует замены', value: 'needs_replacement' }], defaultValue: 'ok' },
  ],
  aquarium: [
    { key: 'unit_present', label: 'Наличие аквариума', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'glass_condition', label: 'Состояние стёкол (чистота)', type: 'select', options: [{ label: 'Чистые', value: 'clean' }, { label: 'Требуют очистки', value: 'needs_cleaning' }], defaultValue: 'clean' },
    { key: 'compressor', label: 'Компрессор/аэратор', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'hose_integrity', label: 'Герметичность шлангов', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'water_condition', label: 'Состояние воды', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
  ],
  bubble_panel: [
    { key: 'unit_present', label: 'Наличие панели', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'glass_condition', label: 'Состояние стёкол', type: 'select', options: [{ label: 'Чистые', value: 'clean' }, { label: 'Требуют очистки', value: 'needs_cleaning' }], defaultValue: 'clean' },
    { key: 'compressor', label: 'Компрессор/аэратор', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'hose_integrity', label: 'Герметичность шлангов', type: 'select', options: BOOL_OPTIONS, defaultValue: true },
    { key: 'air_intensity', label: 'Интенсивность подачи воздуха', type: 'select', options: SATISFACTORY_OPTIONS, defaultValue: 'satisfactory' },
  ],
};

export default function TaskPage() {
  const { message } = App.useApp();
  const { visitId, taskId } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedRecs, setSelectedRecs] = useState<string[]>([]);
  const [conclusion, setConclusion] = useState<string>('ok');
  const [saving, setSaving] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const loadedParamsRef = useRef<Record<string, any>>({});
  const location = useLocation();

  const METER_CODES = ['schetchik_electroshc', 'schetchik_hvs', 'schetchik_gvs'];

  const handleAutoSave = useCallback(async () => {
    if (!visitId || !taskId || !task) return;
    const allValues = form.getFieldsValue(true);
    const { conclusion: formConclusion, additionalRecommendations, ...formParamValues } = allValues;
    const finalConclusion = formConclusion || conclusion;
    const parameters = { ...loadedParamsRef.current, ...formParamValues, conclusion: finalConclusion };
    await api.updateTask(visitId, taskId, {
      parameters,
      selectedRecommendationIds: selectedRecs,
      additionalRecommendations: additionalRecommendations || '',
      conclusion: finalConclusion,
    });
  }, [visitId, taskId, task, form, conclusion, selectedRecs]);

  const {
    isSaving: autoSaving,
    lastSavedAt,
    markDirty: markAutoSaveDirty,
    resetDirty: resetAutoSave,
  } = useAutoSave(handleAutoSave, {
    enabled: !loading,
    isSubmitting: saving,
  });

  useEffect(() => {
    if (!visitId || !taskId) return;
    setFormInitialValues(null);
    setLoading(true);

    api.getTask(visitId, taskId).then(async t => {
      setTask(t);
      const params = (t.parameters || {}) as Record<string, any>;
      const { conclusion: c, ...rest } = params;
      const eqCode = t.equipmentType?.code || '';
      const config = PARAM_CONFIG[eqCode] || [];
      const defaults: Record<string, any> = {};
      for (const p of config) {
        if (p.defaultValue !== undefined) defaults[p.key] = p.defaultValue;
      }
      const mergedParams = { ...defaults, ...rest };

      // Автозаполнение полей счётчиков из связанного оборудования
      const autofilled = new Set<string>();
      if (METER_CODES.includes(eqCode) && t.objectEquipmentId) {
        if (!mergedParams.model && (t.brand || t.model)) {
          mergedParams.model = [t.brand, t.model].filter(Boolean).join(' ').trim();
          autofilled.add('model');
        }
        if (!mergedParams.serial_number && t.serialNumber) {
          mergedParams.serial_number = t.serialNumber;
          autofilled.add('serial_number');
        }
      }
      setAutoFilledFields(autofilled);

      loadedParamsRef.current = mergedParams;
      const conclusionValue = c || 'ok';
      setConclusion(conclusionValue);
      setSelectedRecs(t.selectedRecommendationIds || []);
      if (t.equipmentType) {
        const recs = await api.getRecommendations(t.equipmentType.id);
        setRecommendations(recs);
      }
      const photos = await api.getPhotos(taskId);
      setPhotoCount(photos.length);

      const initVals = {
        ...mergedParams,
        conclusion: conclusionValue,
        additionalRecommendations: t.additionalRecommendations || '',
      };

      setFormKey(k => k + 1);
      setFormInitialValues(initVals);
      setLoading(false);
    });
  }, [visitId, taskId, location.key]);

  // Set form values after form renders with new key
  useEffect(() => {
    if (!loading && formInitialValues && Object.keys(formInitialValues).length > 0) {
      const fields = Object.entries(formInitialValues).map(([name, value]) => ({
        name,
        value,
        touched: true,
      }));
      const timer = setTimeout(() => {
        form.setFields(fields);
        resetAutoSave();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [formKey]);

  const handleSave = async () => {
    if (!visitId || !taskId || !task) return;
    try {
      await form.validateFields();
      setSaving(true);

      const allValues = form.getFieldsValue(true);
      const { conclusion: formConclusion, additionalRecommendations, ...formParamValues } = allValues;
      const finalConclusion = formConclusion || conclusion;
      const parameters = { ...loadedParamsRef.current, ...formParamValues, conclusion: finalConclusion };

      const photosRequired = task.equipmentType?.photosRequired || 1;
      const hasAllPhotos = photoCount >= photosRequired;
      const status = hasAllPhotos ? 'completed' : 'in_progress';

      await api.updateTask(visitId, taskId, {
        parameters,
        selectedRecommendationIds: selectedRecs,
        additionalRecommendations: additionalRecommendations || '',
        conclusion: finalConclusion,
        status,
      });
      message.success(hasAllPhotos ? 'Сохранено' : 'Параметры сохранены. Загрузите фотографии для завершения');
      navigate(`/visit/${visitId}`);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGoToPhotos = async () => {
    // Save parameters before going to photos
    if (!visitId || !taskId || !task) {
      navigate(`/visit/${visitId}/task/${taskId}/photos`);
      return;
    }
    try {
      const allValues = form.getFieldsValue(true);
      const { conclusion: formConclusion, additionalRecommendations, ...formParamValues } = allValues;
      const finalConclusion = formConclusion || conclusion;
      const parameters = { ...loadedParamsRef.current, ...formParamValues, conclusion: finalConclusion };

      await api.updateTask(visitId, taskId, {
        parameters,
        selectedRecommendationIds: selectedRecs,
        additionalRecommendations: additionalRecommendations || '',
        conclusion: finalConclusion,
      });
    } catch {
      // Silent save - don't block navigation
    }
    navigate(`/visit/${visitId}/task/${taskId}/photos`);
  };

  const handleReset = async () => {
    if (!visitId || !taskId) return;
    await api.resetTask(visitId, taskId);
    message.success('Задача сброшена');
    navigate(`/visit/${visitId}`);
  };

  const equipmentCode = task?.equipmentType?.code || '';
  const paramConfig = PARAM_CONFIG[equipmentCode] || [];

  if (loading || formInitialValues === null) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/visit/${visitId}`)}>Назад</Button>
        <div className="page-title" style={{ margin: 0 }}>{task?.equipmentType?.name}</div>
      </div>

      <Card>
        <Form form={form} key={formKey} initialValues={formInitialValues} layout="vertical" onValuesChange={markAutoSaveDirty}>
          {paramConfig.map(p => (
            <Form.Item
              key={p.key}
              label={
                autoFilledFields.has(p.key) ? (
                  <span>
                    {p.label}{' '}
                    <Tooltip title="Автозаполнено из справочника объекта">
                      <span style={{ cursor: 'help' }}>📋</span>
                    </Tooltip>
                  </span>
                ) : p.label
              }
              name={p.key}
              rules={p.required ? [{ required: true, message: 'Заполните поле' }] : []}
            >
              {p.type === 'select' ? (
                <Select options={p.options} placeholder="Выберите..." />
              ) : p.type === 'number' ? (
                <Input type="number" placeholder="Введите значение" />
              ) : (
                <Input placeholder="Введите значение" />
              )}
            </Form.Item>
          ))}

          <Form.Item label="Заключение" name="conclusion" rules={[{ required: true }]}>
            <Select options={CONCLUSION_OPTIONS} onChange={(v) => setConclusion(v)} />
          </Form.Item>

          {recommendations.length > 0 && (
            <Form.Item label="Типовые рекомендации">
              <Checkbox.Group value={selectedRecs} onChange={(v) => { setSelectedRecs(v as string[]); markAutoSaveDirty(); }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recommendations.map(r => (
                    <Checkbox key={r.id} value={r.id}>{r.text}</Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          )}

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.conclusion !== cur.conclusion}>
            {({ getFieldValue }) => {
              const currentConclusion = getFieldValue('conclusion');
              const isRequired = currentConclusion === 'ok_with_notes' || currentConclusion === 'faulty';
              return (
                <Form.Item
                  label="Дополнительные рекомендации"
                  name="additionalRecommendations"
                  rules={isRequired ? [{ required: true, message: 'Обязательно при замечаниях' }] : []}
                >
                  <TextArea rows={3} placeholder="Опишите проблему или рекомендации..." />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>

        <Space style={{ width: '100%' }} direction="vertical" size="middle">
          <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />} block size="large">
            Сохранить и вернуться в чек-лист
          </Button>
          {(autoSaving || lastSavedAt) && (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#999' }}>
              {autoSaving ? 'Автосохранение...' : `Сохранено ${dayjs(lastSavedAt).fromNow()}`}
            </div>
          )}
          <Space>
            <Button onClick={() => navigate(`/visit/${visitId}`)}>Назад</Button>
            <Button icon={<CameraOutlined />} onClick={handleGoToPhotos}>Фото</Button>
            <Popconfirm title="Сбросить задачу? Все данные будут удалены." onConfirm={handleReset} okText="Да" cancelText="Нет">
              <Button danger>Сбросить задачу</Button>
            </Popconfirm>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
