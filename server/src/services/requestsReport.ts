import fs from 'fs';
import path from 'path';
import { resizeForPreview } from './imageProcessor.js';
import { getRequiredParams } from '../../../shared/types/params.js';

const CONCLUSION_MAP: Record<string, string> = {
  ok: 'Исправно, замечаний нет',
  ok_with_notes: 'Исправно, есть замечания',
  faulty: 'Неисправно',
};

const CONCLUSION_COLORS: Record<string, string> = {
  ok: '#52c41a',
  ok_with_notes: '#faad14',
  faulty: '#ff4d4f',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#52c41a',
  sent: '#52c41a',
  corrected_by_tm: '#52c41a',
  in_progress: '#faad14',
  planned: '#1890ff',
  not_started: '#ff4d4f',
  awaiting_assignment: '#ff4d4f',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Запланирован',
  not_started: 'Не начат',
  awaiting_assignment: 'Ожидает назначения',
  in_progress: 'В работе',
  completed: 'Завершён',
  sent: 'Отправлен',
  sent_by_engineer: 'Отправлен инженером',
  sent_by_tm: 'Отправлен ТМ',
  corrected_by_tm: 'Откорректирован ТМ',
};

const PARAM_LABELS: Record<string, string> = {
  contact_connections: 'Состояние контактных соединений',
  neutral_conductor: 'Состояние нулевого проводника',
  grounding_circuit: 'Состояние заземляющего контура',
  wire_condition: 'Состояние проводов (оплавление, подгоревшая изоляция)',
  locking_devices: 'Исправность всех запирающих устройств',
  emergency_lighting: 'Исправность работы аварийного освещения',
  rcd_breakers: 'Исправность работы УЗО, автоматов диф.защиты',
  model: 'Модель счётчика',
  serial_number: 'Номер счётчика',
  current_transformer: 'Трансформатор тока',
  seal_present: 'Наличие пломбы',
  readings: 'Показания',
  unit_present: 'Наличие вентиляционной установки',
  operating_mode: 'Режим работы',
  controller_errors: 'Наличие аварий и ошибок контроллера',
  extraneous_noise: 'Наличие посторонних шумов',
  filter_condition: 'Состояние воздушного фильтра',
  temperature_before: 'Температура воздуха до теплообменника',
  temperature_after: 'Температура воздуха после теплообменника',
  operability: 'Работоспособность',
  room_temperature: 'Температура помещения на уровне 1,2м от пола',
  drain_flush_needed: 'Необходимость внеплановой промывки дренажной системы',
  refrigerant_leaks: 'Наличие утечек хладагента',
  cooling_capacity_kw: 'Холодопроизводительность, кВт',
  line_leaks: 'Наличие утечек на трассах',
  unit_flush_needed: 'Необходимость внеплановой промывки наружного блока',
  hvs_pipe_damage: 'Наличие повреждений трубопровода ХВС',
  hws_pipe_damage: 'Наличие повреждений трубопровода ГВС',
  hvs_corrosion: 'Наличие коррозии на трубопроводах ХВС',
  hws_corrosion: 'Наличие коррозии на трубопроводах ГВС',
  hvs_leaks: 'Наличие свищей/протечек на трубопроводах ХВС',
  hws_leaks: 'Наличие свищей/протечек на трубопроводах ГВС',
  fastener_issues: 'Наличие неисправностей крепежей',
  hvs_other_issues: 'Наличие прочих неисправностей трубопроводов ХВС',
  hws_other_issues: 'Наличие прочих неисправностей трубопроводов ГВС',
  valve_tightness: 'Герметичность запорной, защитной и регулирующей арматуры',
  drain_condition: 'Сливные воронки, желоба, выпускные воронки',
  pipe_damage: 'Наличие повреждений трубопровода',
  corrosion: 'Наличие коррозии на трубопроводах',
  leaks: 'Наличие свищей/протечек на трубопроводах',
  other_issues: 'Наличие прочих неисправностей трубопроводов',
  air_locks: 'Наличие завоздушивания системы',
  instruments_ok: 'Контрольно-измерительные приборы исправны',
  heating_temperature: 'Температуры приборов отопления',
  engine_condition: 'Состояние двигателя',
  oil_level: 'Уровень масла',
  fuel_level: 'Уровень топлива',
  air_filter: 'Состояние воздушного фильтра',
  battery_condition: 'Состояние АКБ',
  manual_start: 'Ручной запуск исправен',
  runtime_hours: 'Наработка, моточасы',
  spark_plug: 'Состояние свечи зажигания',
  battery_capacity: 'Ёмкость батарей, %',
  ventilation: 'Вентиляция в помещении',
  error_indicators: 'Индикаторы ошибок',
  temperature: 'Температура в помещении, °C',
  cabin_condition: 'Состояние кабины',
  door_mechanism: 'Механизм дверей',
  guide_rails: 'Состояние направляющих рельсов',
  emergency_phone: 'Телефон аварийной связи',
  lighting: 'Освещение кабины',
  floor_leveling: 'Точность остановки (выравнивание пола)',
  platform_condition: 'Состояние платформы',
  limit_switches: 'Концевые выключатели',
  presence_sensors: 'Датчики присутствия',
  emergency_lowering: 'Механизм аварийного опускания',
  surface_condition: 'Состояние поверхности платформы',
  heat_exchangers: 'Состояние теплообменников',
  circulation_pumps: 'Циркуляционные насосы',
  safety_automation: 'Автоматика безопасности',
  filters_condition: 'Состояние фильтров/грязевиков',
  system_pressure: 'Давление в системе, бар',
  heat_exchanger: 'Состояние теплообменника',
  combustion_chamber: 'Герметичность камеры сгорания',
  chimney_draft: 'Тяга в дымоходе',
  safety_valves: 'Предохранительные клапаны',
  water_temperature: 'Температура теплоносителя, °C',
  body_integrity: 'Целостность корпуса',
  chamber_condition: 'Состояние внутренней камеры',
  check_valve: 'Обратный клапан',
  float_sensor: 'Поплавковый датчик уровня',
  auto_start: 'Автоматическое включение',
  duct_condition: 'Состояние гофрированного воздуховода',
  remote_control: 'Пульт ДУ исправен',
  mechanism_condition: 'Состояние механизмов',
  photoelements: 'Фотоэлементы/датчики препятствий',
  manual_release: 'Ручной разблокировочный механизм',
  anchor_fastening: 'Крепление анкеров',
  gearbox_play: 'Люфт редуктора',
  lubrication: 'Смазка механизмов',
  brewing_unit: 'Состояние заварочного блока',
  descaling: 'Необходимость декальцинации',
  water_filters: 'Водяные фильтры',
  cappuccinator: 'Капучинатор',
  display_errors: 'Ошибки на дисплее',
  pre_filter: 'Фильтр предварительной очистки',
  hepa_filter: 'HEPA-фильтр',
  air_quality_sensor: 'Датчик качества воздуха',
  fan_operation: 'Работа вентилятора',
  hot_water_temp: 'Температура горячей воды, °C',
  cold_water_temp: 'Температура холодной воды, °C',
  tank_condition: 'Состояние баков',
  glass_condition: 'Состояние стёкол',
  compressor: 'Компрессор/аэратор',
  hose_integrity: 'Герметичность шлангов',
  water_condition: 'Состояние воды',
  air_intensity: 'Интенсивность подачи воздуха',
};

const ITEM_TYPE_NAMES: Record<string, string> = {
  splitvn: 'Внутр. блок СС', mssvn: 'Внутр. блок МСС', vrv_vn: 'Внутр. блок VRV',
  splitnar: 'Наружн. блок СС', mssnar: 'Наружн. блок МСС', vrv_nar: 'Наружн. блок VRV',
};

const TZ = 'Europe/Moscow';

function formatDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
}

function formatParamValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Да' : 'Нет';
  const VALUE_MAP: Record<string, string> = {
    satisfactory: 'Удовлетворительно',
    unsatisfactory: 'Неудовлетворительно',
    clean: 'Чистый',
    needs_replacement: 'Требует замены',
    needs_cleaning: 'Необходима очистка',
    needs_topup: 'Требуется доливка',
    on: 'Включена',
    off: 'Выключена',
    normal: 'В норме',
    below_normal: 'Ниже нормы',
    full: 'Полный',
    medium: 'Средний',
    low: 'Низкий',
    ok: 'Исправно',
    defective: 'Дефекты',
    damaged: 'Повреждён',
    sufficient: 'Достаточная',
    needed: 'Требуется',
    weak: 'Слабая',
    none: 'Отсутствует',
    mains: 'От сети',
    battery: 'От батарей',
    bypass: 'Байпас',
  };
  if (typeof val === 'string' && VALUE_MAP[val]) return VALUE_MAP[val];
  return String(val);
}

export interface RequestsReportVisit {
  id: string;
  dateStart: Date;
  engineerName: string;
  status: string;
  tasks: RequestsReportTask[];
}

export interface RequestsReportTask {
  id: string;
  taskType?: string | null;
  conclusion?: string | null;
  brand?: string;
  model?: string;
  serialNumber?: string;
  parameters?: unknown;
  selectedRecommendationIds?: string[];
  additionalRecommendations?: string | null;
  equipmentType?: { name: string; code: string } | null;
  roomType?: { name: string } | null;
  photos?: { fileName: string; filePath: string; moment: string; phash?: string | null; isDuplicate?: boolean }[];
  equipmentItems?: {
    id: string;
    status?: string | null;
    objectEquipment?: {
      equipmentTypeCode?: string | null;
      brand?: string | null;
      model?: string | null;
      serialNumber?: string | null;
      isOutdoorUnit?: boolean;
    } | null;
    photos?: { fileName: string; filePath: string; moment: string; phash?: string | null; isDuplicate?: boolean }[];
  }[];
}

export interface RequestsReportRequest {
  externalRequestId: string;
  address: string;
  status: 'completed' | 'in_progress' | 'not_started';
  visits: RequestsReportVisit[];
}

export interface RequestsReportKPI {
  totalRequests: number;
  completedRequests: number;
  inProgressRequests: number;
  notStartedRequests: number;
  sla: number;
  totalVisits: number;
  totalCompletedTasks: number;
  totalServicedAddresses: number;
}

export interface RequestsReportOptions {
  periodType: 'created' | 'closed';
  dateFrom: string;
  dateTo: string;
  generatedBy: { fullName: string; role: string };
  recMap: Map<string, string>;
}

const MAX_PHOTOS = 1000;

async function photoToBase64(filePath: string, simplified: boolean): Promise<string> {
  if (simplified) return '';
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.warn(`[requestsReport] Фото не найдено: ${absPath}`);
    return '';
  }
  try {
    const buf = await resizeForPreview(absPath);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch (err) {
    console.warn(`[requestsReport] Ошибка resizeForPreview для ${absPath}:`, err);
    return '';
  }
}

function conclusionBadge(conclusion?: string | null): string {
  const label = conclusion ? (CONCLUSION_MAP[conclusion] || conclusion) : '—';
  const color = conclusion ? (CONCLUSION_COLORS[conclusion] || '#999') : '#999';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;color:#fff;background:${color};font-size:10pt;">${label}</span>`;
}

function renderParams(params: Record<string, unknown>, equipmentCode: string): string {
  const renderedKeys = new Set<string>();
  let html = '';

  for (const [key, val] of Object.entries(params)) {
    if (['conclusion', 'selected_recommendations', 'additional_recommendations'].includes(key)) continue;
    renderedKeys.add(key);
    const label = PARAM_LABELS[key] || key;
    const isEmpty = val === null || val === undefined || (typeof val === 'string' && val.trim() === '');
    if (isEmpty) {
      html += `<tr><td style="padding:3px 6px;border:1px solid #ddd;font-size:9pt;">${label}</td><td style="padding:3px 6px;border:1px solid #ddd;font-size:9pt;color:#ff4d4f;background:#fff1f0;font-weight:600;">не заполнено</td></tr>`;
    } else {
      html += `<tr><td style="padding:3px 6px;border:1px solid #ddd;font-size:9pt;">${label}</td><td style="padding:3px 6px;border:1px solid #ddd;font-size:9pt;">${formatParamValue(key, val)}</td></tr>`;
    }
  }

  const requiredParams = getRequiredParams(equipmentCode);
  for (const rp of requiredParams) {
    if (!renderedKeys.has(rp.key)) {
      html += `<tr><td style="padding:3px 6px;border:1px solid #ddd;font-size:9pt;">${rp.label}</td><td style="padding:3px 6px;border:1px solid #ddd;font-size:9pt;color:#ff4d4f;background:#fff1f0;font-weight:600;">не заполнено</td></tr>`;
    }
  }

  return html;
}

function renderRecommendations(task: RequestsReportTask, recMap: Map<string, string>): string {
  const selectedRecs = (task.selectedRecommendationIds || []).map(id => recMap.get(id)).filter(Boolean);
  let html = '';
  for (const r of selectedRecs) html += `<li style="font-size:9pt;">${r}</li>`;
  if (task.additionalRecommendations) html += `<li style="font-size:9pt;">${task.additionalRecommendations}</li>`;
  if (!html) return 'Нет';
  return `<ul style="margin:4px 0;padding-left:16px;">${html}</ul>`;
}

async function renderPhotosGrid(photos: { fileName: string; filePath: string; moment: string; isDuplicate?: boolean }[], simplified: boolean): Promise<string> {
  if (photos.length === 0) {
    return '<div style="margin:4px 0;"><span style="display:inline-block;padding:4px 8px;background:#f5f5f5;border-radius:3px;font-size:9pt;color:#999;">Фото отсутствует</span></div>';
  }
  if (simplified) {
    return photos.map(p => `<span style="display:inline-block;margin:2px 4px;padding:2px 6px;background:#f0f0f0;border-radius:3px;font-size:8pt;">📷 ${p.fileName}</span>`).join('');
  }
  
  let html = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:4px 0;">';
  for (const photo of photos) {
    const b64 = await photoToBase64(photo.filePath, false);
    if (b64) {
      const duplicateStyle = photo.isDuplicate ? 'border:2px solid #ff4d4f;' : 'border:1px solid #ddd;';
      const duplicateLabel = photo.isDuplicate ? '<div style="font-size:7pt;color:#ff4d4f;font-weight:600;">Дубликат</div>' : '';
      html += `<div style="text-align:center;max-width:200px;"><img src="${b64}" style="max-width:180px;max-height:140px;${duplicateStyle}border-radius:3px;" /><div style="font-size:7pt;color:#666;">${photo.fileName}</div>${duplicateLabel}</div>`;
    } else {
      html += `<span style="display:inline-block;padding:4px 8px;background:#fff1f0;border:1px solid #ffccc7;border-radius:3px;font-size:8pt;color:#ff4d4f;font-weight:600;">📷 Фото отсутствует: ${photo.fileName}</span>`;
    }
  }
  html += '</div>';
  return html;
}

async function renderTask(task: RequestsReportTask, taskIndex: number, recMap: Map<string, string>, simplified: boolean): Promise<string> {
  const params = (task.parameters || {}) as Record<string, unknown>;
  const eqCode = task.equipmentType?.code || '';
  const paramsHtml = renderParams(params, eqCode);
  const recsHtml = renderRecommendations(task, recMap);

  if (task.taskType === 'group_climate') {
    const items = task.equipmentItems || [];
    const isOutdoor = items.length > 0 && items[0].objectEquipment?.isOutdoorUnit;
    const title = isOutdoor ? 'Наружные блоки кондиционеров' : `Климатическое оборудование (${task.roomType?.name || ''})`;
    const location = isOutdoor ? 'Уровень объекта' : (task.roomType?.name || '—');

    let equipTableHtml = '<table style="width:100%;border-collapse:collapse;margin:4px 0;"><thead><tr style="background:#f5f5f5;">';
    equipTableHtml += '<th style="padding:3px 6px;border:1px solid #ddd;font-size:8pt;">№</th>';
    equipTableHtml += '<th style="padding:3px 6px;border:1px solid #ddd;font-size:8pt;">Вид</th>';
    equipTableHtml += '<th style="padding:3px 6px;border:1px solid #ddd;font-size:8pt;">Изготовитель</th>';
    equipTableHtml += '<th style="padding:3px 6px;border:1px solid #ddd;font-size:8pt;">Модель</th>';
    equipTableHtml += '<th style="padding:3px 6px;border:1px solid #ddd;font-size:8pt;">Сер. №</th>';
    equipTableHtml += '<th style="padding:3px 6px;border:1px solid #ddd;font-size:8pt;">Статус</th>';
    equipTableHtml += '</tr></thead><tbody>';
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const eq = item.objectEquipment;
      const typeName = ITEM_TYPE_NAMES[eq?.equipmentTypeCode || ''] || eq?.equipmentTypeCode || '—';
      const statusLabel = item.status === 'ok' ? 'Исправно' : item.status === 'not_ok' ? 'Неисправно' : '—';
      equipTableHtml += `<tr><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${j + 1}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${typeName}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${eq?.brand || '—'}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${eq?.model || '—'}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${eq?.serialNumber || '—'}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${statusLabel}</td></tr>`;
    }
    equipTableHtml += '</tbody></table>';

    let allPhotos: { fileName: string; filePath: string; moment: string; isDuplicate?: boolean }[] = [];
    for (const item of items) {
      for (const p of (item.photos || [])) allPhotos.push({ ...p, isDuplicate: p.isDuplicate });
    }
    const photosHtml = await renderPhotosGrid(allPhotos, simplified);

    return `
      <div style="margin:8px 0;padding:8px;border:1px solid #e0e0e0;border-radius:4px;">
        <div style="font-weight:600;font-size:10pt;">${taskIndex}. ${title}</div>
        <div style="color:#666;font-size:9pt;">📍 ${location}</div>
        <table style="width:100%;border-collapse:collapse;margin:4px 0;">
          <tr><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;font-weight:600;width:120px;">Изготовитель:</td><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;">—</td></tr>
          <tr><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;font-weight:600;">Модель:</td><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;">—</td></tr>
          <tr><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;font-weight:600;">Сер. №:</td><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;">—</td></tr>
        </table>
        <div style="margin:4px 0;font-size:9pt;font-weight:600;">Единицы оборудования:</div>
        ${equipTableHtml}
        ${paramsHtml ? `<table style="width:100%;margin:4px 0;">${paramsHtml}</table>` : ''}
        <div style="margin:4px 0;font-size:9pt;font-weight:600;">📸 Фотофиксация:</div>
        ${photosHtml}
        <div>Заключение: ${conclusionBadge(task.conclusion)}</div>
        <div style="margin:4px 0;font-size:9pt;font-weight:600;">Рекомендации:</div>
        ${recsHtml}
      </div>`;
  }

  // Individual task
  const equipName = task.equipmentType?.name || '—';
  const location = task.roomType?.name || '—';
  const photosHtml = await renderPhotosGrid(task.photos || [], simplified);

  const equipInfoHtml = `
    <table style="width:100%;border-collapse:collapse;margin:4px 0;">
      <tr><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;font-weight:600;width:120px;">Изготовитель:</td><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;">${task.brand || '—'}</td></tr>
      <tr><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;font-weight:600;">Модель:</td><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;">${task.model || '—'}</td></tr>
      <tr><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;font-weight:600;">Сер. №:</td><td style="padding:2px 6px;border:1px solid #ddd;font-size:9pt;">${task.serialNumber || '—'}</td></tr>
    </table>`;

  return `
    <div style="margin:8px 0;padding:8px;border:1px solid #e0e0e0;border-radius:4px;">
      <div style="font-weight:600;font-size:10pt;">${taskIndex}. ${equipName} (${location})</div>
      ${equipInfoHtml}
      ${paramsHtml ? `<table style="width:100%;margin:4px 0;">${paramsHtml}</table>` : ''}
      <div style="margin:4px 0;font-size:9pt;font-weight:600;">📸 Фотофиксация:</div>
      ${photosHtml}
      <div>Заключение: ${conclusionBadge(task.conclusion)}</div>
      <div style="margin:4px 0;font-size:9pt;font-weight:600;">Рекомендации:</div>
      ${recsHtml}
    </div>`;
}

export async function generateRequestsReportHtml(
  requests: RequestsReportRequest[],
  kpi: RequestsReportKPI,
  options: RequestsReportOptions,
): Promise<string> {
  const { periodType, dateFrom, dateTo, generatedBy, recMap } = options;

  // Count total photos
  let totalPhotos = 0;
  for (const req of requests) {
    for (const visit of req.visits) {
      for (const task of visit.tasks) {
        if (task.taskType === 'group_climate') {
          for (const item of (task.equipmentItems || [])) totalPhotos += (item.photos || []).length;
        } else {
          totalPhotos += (task.photos || []).length;
        }
      }
    }
  }
  const simplified = totalPhotos > MAX_PHOTOS;

  console.log(`[requestsReport] Заявок: ${requests.length}, визитов: ${requests.reduce((s, r) => s + r.visits.length, 0)}, фото: ${totalPhotos}, simplified: ${simplified}`);

  const roleLabel = generatedBy.role === 'admin' ? 'Администратор' : generatedBy.role === 'tm' ? 'Территориальный менеджер' : generatedBy.role;
  const periodLabel = periodType === 'created' ? 'дата создания' : 'дата закрытия';

  // Title page
  const titlePage = `
    <div style="text-align:center;padding:60px 20px;page-break-after:always;">
      <h1 style="font-size:22pt;margin-bottom:20px;">ОТЧЁТ ПО ЗАЯВКАМ</h1>
      <p style="font-size:12pt;color:#555;margin:8px 0;">Период: ${dateFrom} — ${dateTo} (${periodLabel})</p>
      <p style="font-size:12pt;color:#555;margin:8px 0;"><strong>Дата формирования:</strong> ${new Date().toLocaleDateString('ru-RU', { timeZone: TZ })}</p>
      <p style="font-size:12pt;color:#555;margin:8px 0;"><strong>Сформировал:</strong> ${generatedBy.fullName} (${roleLabel})</p>
      ${simplified ? `<p style="color:#faad14;font-size:9pt;margin-top:30px;">⚠ Отчёт сформирован в упрощённом режиме: превью фотографий заменены текстовыми ссылками (${totalPhotos} фото).</p>` : ''}
    </div>
  `;

  // KPI page
  const kpiPage = `
    <div style="page-break-after:always;">
      <h2 style="border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:20px;">Сводные показатели</h2>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:20px 0;">
        <div style="padding:16px;border:2px solid #1890ff;border-radius:8px;text-align:center;background:#f0f5ff;">
          <div style="font-size:28pt;font-weight:bold;color:#1890ff;">${kpi.totalRequests}</div>
          <div style="font-size:10pt;color:#666;margin-top:4px;">Общее количество заявок</div>
        </div>
        <div style="padding:16px;border:2px solid #52c41a;border-radius:8px;text-align:center;background:#f6ffed;">
          <div style="font-size:28pt;font-weight:bold;color:#52c41a;">${kpi.completedRequests}</div>
          <div style="font-size:10pt;color:#666;margin-top:4px;">Завершены</div>
        </div>
        <div style="padding:16px;border:2px solid #faad14;border-radius:8px;text-align:center;background:#fffbe6;">
          <div style="font-size:28pt;font-weight:bold;color:#faad14;">${kpi.inProgressRequests}</div>
          <div style="font-size:10pt;color:#666;margin-top:4px;">В работе</div>
        </div>
        <div style="padding:16px;border:2px solid #d9d9d9;border-radius:8px;text-align:center;background:#fafafa;">
          <div style="font-size:28pt;font-weight:bold;color:#8c8c8c;">${kpi.notStartedRequests}</div>
          <div style="font-size:10pt;color:#666;margin-top:4px;">Не начаты</div>
        </div>
        <div style="padding:16px;border:2px solid #722ed1;border-radius:8px;text-align:center;background:#f9f0ff;">
          <div style="font-size:28pt;font-weight:bold;color:#722ed1;">${kpi.sla.toFixed(1)}%</div>
          <div style="font-size:10pt;color:#666;margin-top:4px;">SLA (выполнение в срок)</div>
        </div>
        <div style="padding:16px;border:2px solid #13c2c2;border-radius:8px;text-align:center;background:#e6fffb;">
          <div style="font-size:28pt;font-weight:bold;color:#13c2c2;">${kpi.totalVisits}</div>
          <div style="font-size:10pt;color:#666;margin-top:4px;">Совершённых визитов</div>
        </div>
        <div style="padding:16px;border:2px solid #eb2f96;border-radius:8px;text-align:center;background:#fff0f6;">
          <div style="font-size:28pt;font-weight:bold;color:#eb2f96;">${kpi.totalCompletedTasks}</div>
          <div style="font-size:10pt;color:#666;margin-top:4px;">Выполненных задач</div>
        </div>
        <div style="padding:16px;border:2px solid #fa8c16;border-radius:8px;text-align:center;background:#fff7e6;">
          <div style="font-size:28pt;font-weight:bold;color:#fa8c16;">${kpi.totalServicedAddresses}</div>
          <div style="font-size:10pt;color:#666;margin-top:4px;">Обслуженных объектов</div>
        </div>
      </div>
    </div>
  `;

  // Request sheets
  let sheetsHtml = '';
  
  // Разделяем заявки с визитами и без визитов
  const requestsWithVisits = requests.filter(r => r.visits.length > 0);
  const requestsWithoutVisits = requests.filter(r => r.visits.length === 0);
  
  // Рендерим заявки с визитами (каждая на отдельном листе)
  for (const req of requestsWithVisits) {
    const statusColor = STATUS_COLORS[req.status] || '#999';
    const statusLabel = req.status === 'completed' ? 'Завершена' : req.status === 'in_progress' ? 'В работе' : 'Не начата';

    sheetsHtml += `<div style="page-break-before:always;">`;
    sheetsHtml += `<h2 style="border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:20px;">Заявка: ${req.externalRequestId} (${req.address})</h2>`;

    for (const visit of req.visits) {
      const visitStatusColor = STATUS_COLORS[visit.status] || '#999';
      const visitStatusLabel = STATUS_LABELS[visit.status] || visit.status;
      const issuesCount = visit.tasks.filter(t => t.conclusion && t.conclusion !== 'ok').length;

      sheetsHtml += `
        <div style="margin:12px 0;padding:10px;border:1px solid #ccc;border-radius:6px;">
          <h3 style="margin:0 0 6px;">Визит: ${formatDate(visit.dateStart)}</h3>
          <p style="margin:2px 0;font-size:9pt;"><strong>Инженер:</strong> ${visit.engineerName}</p>
          <p style="margin:2px 0;font-size:9pt;"><strong>Статус:</strong> <span style="color:${visitStatusColor};font-weight:600;">${visitStatusLabel}</span></p>
          <p style="margin:2px 0;font-size:9pt;"><strong>Задач:</strong> ${visit.tasks.length} | <strong>Замечаний:</strong> ${issuesCount}</p>
        </div>
      `;

      for (let ti = 0; ti < visit.tasks.length; ti++) {
        sheetsHtml += await renderTask(visit.tasks[ti], ti + 1, recMap, simplified);
      }
    }
    sheetsHtml += '</div>';
  }
  
  // Рендерим заявки без визитов (все на одном листе в виде таблицы)
  if (requestsWithoutVisits.length > 0) {
    sheetsHtml += `<div style="page-break-before:always;">`;
    sheetsHtml += `<h2 style="border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:20px;">Заявки без визитов (не назначенные)</h2>`;
    sheetsHtml += `<table style="width:100%;border-collapse:collapse;margin:20px 0;">`;
    sheetsHtml += `<thead><tr style="background:#f5f5f5;">`;
    sheetsHtml += `<th style="padding:8px;border:1px solid #ddd;font-size:10pt;text-align:left;">№</th>`;
    sheetsHtml += `<th style="padding:8px;border:1px solid #ddd;font-size:10pt;text-align:left;">Номер заявки</th>`;
    sheetsHtml += `<th style="padding:8px;border:1px solid #ddd;font-size:10pt;text-align:left;">Адрес</th>`;
    sheetsHtml += `<th style="padding:8px;border:1px solid #ddd;font-size:10pt;text-align:left;">Статус</th>`;
    sheetsHtml += `</tr></thead><tbody>`;
    
    for (let i = 0; i < requestsWithoutVisits.length; i++) {
      const req = requestsWithoutVisits[i];
      const statusColor = STATUS_COLORS[req.status] || '#999';
      const statusLabel = req.status === 'completed' ? 'Завершена' : req.status === 'in_progress' ? 'В работе' : 'Не начата';
      
      sheetsHtml += `<tr>`;
      sheetsHtml += `<td style="padding:6px;border:1px solid #ddd;font-size:9pt;">${i + 1}</td>`;
      sheetsHtml += `<td style="padding:6px;border:1px solid #ddd;font-size:9pt;">${req.externalRequestId}</td>`;
      sheetsHtml += `<td style="padding:6px;border:1px solid #ddd;font-size:9pt;">${req.address}</td>`;
      sheetsHtml += `<td style="padding:6px;border:1px solid #ddd;font-size:9pt;color:${statusColor};font-weight:600;">${statusLabel}</td>`;
      sheetsHtml += `</tr>`;
    }
    
    sheetsHtml += `</tbody></table>`;
    sheetsHtml += `</div>`;
  }

  if (!sheetsHtml) {
    sheetsHtml = '<p style="text-align:center;color:#999;font-size:14pt;margin:40px 0;">Нет данных за выбранный период</p>';
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Отчёт по заявкам</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin: 20px; }
  h1 { text-align: center; font-size: 18pt; }
  h2 { color: #333; margin-top: 20px; font-size: 14pt; }
  h3 { color: #444; font-size: 12pt; }
  table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>
  ${titlePage}
  ${kpiPage}
  ${sheetsHtml}
  <div style="text-align:center;color:#999;font-size:9pt;margin-top:40px;border-top:1px solid #eee;padding-top:10px;">
    <p>Отчёт сформирован: ${new Date().toLocaleString('ru-RU', { timeZone: TZ })}</p>
  </div>
</body>
</html>`;
}
