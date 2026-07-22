import fs from 'fs';
import path from 'path';
import { resizeForPreview } from './imageProcessor.js';

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
};

const SEASON_MAP: Record<string, string> = { summer: 'Лето', winter: 'Зима' };

function formatBool(val: unknown): string { return val ? 'Да' : 'Нет'; }

function formatParamValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return formatBool(val);
  if (val === 'satisfactory') return 'Удовлетворительно';
  if (val === 'unsatisfactory') return 'Неудовлетворительно';
  if (val === 'clean') return 'Чистый';
  if (val === 'needs_replacement') return 'Требует замену';
  if (val === 'needs_cleaning') return 'Необходима очистка';
  if (val === 'on') return 'Включена';
  if (val === 'off') return 'Выключена';
  return String(val);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function conclusionBadge(conclusion?: string | null): string {
  const label = conclusion ? (CONCLUSION_MAP[conclusion] || conclusion) : '—';
  const color = conclusion ? (CONCLUSION_COLORS[conclusion] || '#999') : '#999';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;color:#fff;background:${color};font-size:10pt;">${label}</span>`;
}

function getSpecLabel(vik?: boolean, iszh?: boolean): string {
  if (vik && iszh) return 'ВиК + ИСЖ';
  if (vik) return 'ВиК';
  if (iszh) return 'ИСЖ';
  return '';
}

export interface UnifiedReportVisit {
  id: string;
  dateStart: Date;
  timeStart: string;
  timeEnd?: string | null;
  engineerName: string;
  season?: string | null;
  status: string;
  address: { fullAddress: string };
  engineerSpec?: { specializationVik: boolean; specializationIszh: boolean };
  tasks: UnifiedReportTask[];
}

export interface UnifiedReportTask {
  id: string;
  taskType?: string | null;
  conclusion?: string | null;
  comment?: string | null;
  parameters?: unknown;
  selectedRecommendationIds?: string[];
  additionalRecommendations?: string | null;
  equipmentType?: { name: string } | null;
  roomType?: { name: string } | null;
  photos?: { fileName: string; filePath: string; moment: string }[];
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
    photos?: { fileName: string; filePath: string; moment: string }[];
  }[];
}

export interface UnifiedReportOptions {
  type: 'period' | 'objects';
  dateFrom: string;
  dateTo: string;
  generatedBy: { fullName: string; role: string };
  recMap: Map<string, string>;
  simplifiedMode?: boolean;
}

const MAX_PHOTOS = 200;

const ITEM_TYPE_NAMES: Record<string, string> = {
  splitvn: 'Внутр. блок СС', mssvn: 'Внутр. блок МСС', vrv_vn: 'Внутр. блок VRV',
  splitnar: 'Наружн. блок СС', mssnar: 'Наружн. блок МСС', vrv_nar: 'Наружн. блок VRV',
};

async function photoToBase64(filePath: string, simplified: boolean): Promise<string> {
  if (simplified) return '';
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) return '';
  try {
    const buf = await resizeForPreview(absPath);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

function renderParams(params: Record<string, unknown>): string {
  let html = '';
  for (const [key, val] of Object.entries(params)) {
    if (['conclusion', 'selected_recommendations', 'additional_recommendations'].includes(key)) continue;
    const label = PARAM_LABELS[key] || key;
    html += `<tr><td style="padding:3px 6px;border:1px solid #ddd;font-size:9pt;">${label}</td><td style="padding:3px 6px;border:1px solid #ddd;font-size:9pt;">${formatParamValue(key, val)}</td></tr>`;
  }
  return html;
}

function renderRecommendations(task: UnifiedReportTask, recMap: Map<string, string>): string {
  const selectedRecs = (task.selectedRecommendationIds || []).map(id => recMap.get(id)).filter(Boolean);
  let html = '';
  for (const r of selectedRecs) html += `<li style="font-size:9pt;">${r}</li>`;
  if (task.additionalRecommendations) html += `<li style="font-size:9pt;">${task.additionalRecommendations}</li>`;
  return html;
}

function renderPhotosText(photos: { fileName: string; moment: string }[]): string {
  return photos.map(p =>
    `<span style="display:inline-block;margin:2px 4px;padding:2px 6px;background:#f0f0f0;border-radius:3px;font-size:8pt;">📷 ${p.fileName} (${p.moment === 'before' ? 'до' : 'после'})</span>`
  ).join('');
}

async function renderPhotosGrid(photos: { fileName: string; filePath: string; moment: string }[], simplified: boolean): Promise<string> {
  if (simplified) return renderPhotosText(photos);
  let html = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:4px 0;">';
  for (const photo of photos) {
    const b64 = await photoToBase64(photo.filePath, false);
    const momentLabel = photo.moment === 'before' ? 'до' : 'после';
    if (b64) {
      html += `<div style="text-align:center;max-width:200px;"><img src="${b64}" style="max-width:180px;max-height:140px;border:1px solid #ddd;border-radius:3px;" /><div style="font-size:7pt;color:#666;">${photo.fileName} (${momentLabel})</div></div>`;
    } else {
      html += `<span style="display:inline-block;padding:2px 6px;background:#fff3cd;border-radius:3px;font-size:8pt;">⚠ Фото отсутствует: ${photo.fileName}</span>`;
    }
  }
  html += '</div>';
  return html;
}

async function renderTask(task: UnifiedReportTask, taskIndex: number, recMap: Map<string, string>, simplified: boolean): Promise<string> {
  const params = (task.parameters || {}) as Record<string, unknown>;
  const paramsHtml = renderParams(params);
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
      const statusLabel = item.status === 'ok' ? '✅ Исправно' : item.status === 'not_ok' ? '⚠️ Неисправно' : '—';
      equipTableHtml += `<tr><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${j + 1}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${typeName}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${eq?.brand || '—'}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${eq?.model || '—'}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${eq?.serialNumber || '—'}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:8pt;">${statusLabel}</td></tr>`;
    }
    equipTableHtml += '</tbody></table>';

    let allPhotos: { fileName: string; filePath: string; moment: string }[] = [];
    for (const item of items) {
      for (const p of (item.photos || [])) allPhotos.push(p);
    }
    const photosHtml = await renderPhotosGrid(allPhotos, simplified);

    return `
      <div style="margin:8px 0;padding:8px;border:1px solid #e0e0e0;border-radius:4px;">
        <div style="font-weight:600;font-size:10pt;">${taskIndex}. ${title}</div>
        <div style="color:#666;font-size:9pt;">📍 ${location}</div>
        ${paramsHtml ? `<table style="width:100%;margin:4px 0;">${paramsHtml}</table>` : ''}
        <div style="margin:4px 0;font-size:9pt;font-weight:600;">Единицы оборудования:</div>
        ${equipTableHtml}
        <div style="margin:4px 0;font-size:9pt;font-weight:600;">📸 Фотофиксация:</div>
        ${photosHtml}
        <div>Заключение: ${conclusionBadge(task.conclusion)}</div>
        ${recsHtml ? `<ul style="margin:4px 0;padding-left:16px;">${recsHtml}</ul>` : ''}
      </div>`;
  }

  // Individual task
  const equipName = task.equipmentType?.name || '—';
  const location = task.roomType?.name || (task.comment || '—');
  const photosHtml = await renderPhotosGrid(task.photos || [], simplified);

  return `
    <div style="margin:8px 0;padding:8px;border:1px solid #e0e0e0;border-radius:4px;">
      <div style="font-weight:600;font-size:10pt;">${taskIndex}. ${equipName}${task.comment ? ` (${task.comment})` : ''}</div>
      <div style="color:#666;font-size:9pt;">📍 ${location}</div>
      ${paramsHtml ? `<table style="width:100%;margin:4px 0;">${paramsHtml}</table>` : ''}
      <div style="margin:4px 0;font-size:9pt;font-weight:600;">📸 Фотофиксация:</div>
      ${photosHtml}
      <div>Заключение: ${conclusionBadge(task.conclusion)}</div>
      ${recsHtml ? `<ul style="margin:4px 0;padding-left:16px;">${recsHtml}</ul>` : ''}
    </div>`;
}

export async function generateUnifiedReportHtml(
  visits: UnifiedReportVisit[],
  options: UnifiedReportOptions,
): Promise<string> {
  const { type, dateFrom, dateTo, generatedBy, recMap, simplifiedMode } = options;

  // Count total photos
  let totalPhotos = 0;
  for (const v of visits) {
    for (const t of v.tasks) {
      if (t.taskType === 'group_climate') {
        for (const item of (t.equipmentItems || [])) totalPhotos += (item.photos || []).length;
      } else {
        totalPhotos += (t.photos || []).length;
      }
    }
  }
  const simplified = simplifiedMode || totalPhotos > MAX_PHOTOS;

  // Group visits by address
  const byAddress = new Map<string, UnifiedReportVisit[]>();
  for (const v of visits) {
    const addr = v.address.fullAddress;
    if (!byAddress.has(addr)) byAddress.set(addr, []);
    byAddress.get(addr)!.push(v);
  }

  // Title page
  const roleLabel = generatedBy.role === 'admin' ? 'Администратор' : generatedBy.role === 'tm' ? 'Территориальный менеджер' : generatedBy.role;
  const reportTitle = type === 'period' ? 'СВОДНЫЙ ОТЧЁТ ЗА ПЕРИОД' : 'ОТЧЁТ ПО ОБЪЕКТАМ';
  const subtitle = type === 'period'
    ? `Период: ${dateFrom} — ${dateTo}`
    : `Объекты: ${[...byAddress.keys()].join('; ')}<br>Период: ${dateFrom} — ${dateTo}`;

  // Stats
  const totalVisits = visits.length;
  const totalTasks = visits.reduce((s, v) => s + v.tasks.length, 0);
  const totalIssues = visits.reduce((s, v) => s + v.tasks.filter(t => t.conclusion && t.conclusion !== 'ok').length, 0);

  // Generate sections per address
  let sectionsHtml = '';
  for (const [addr, addrVisits] of byAddress) {
    sectionsHtml += `<div style="page-break-before:always;"><h2 style="border-bottom:2px solid #333;padding-bottom:4px;">${addr}</h2>`;

    for (let vi = 0; vi < addrVisits.length; vi++) {
      const v = addrVisits[vi];
      const specLabel = v.engineerSpec ? getSpecLabel(v.engineerSpec.specializationVik, v.engineerSpec.specializationIszh) : '';

      sectionsHtml += `
        <div style="margin:12px 0;padding:10px;border:1px solid #ccc;border-radius:6px;">
          <h3 style="margin:0 0 6px;">Визит: ${formatDate(v.dateStart)}</h3>
          <p style="margin:2px 0;font-size:9pt;"><strong>Инженер:</strong> ${v.engineerName}${specLabel ? ` (${specLabel})` : ''}</p>
          <p style="margin:2px 0;font-size:9pt;"><strong>Время:</strong> ${v.timeStart}${v.timeEnd ? ` — ${v.timeEnd}` : ''}${v.season ? ` | <strong>Сезон:</strong> ${SEASON_MAP[v.season] || v.season}` : ''}</p>
          <p style="margin:2px 0;font-size:9pt;"><strong>Задач:</strong> ${v.tasks.length} | <strong>Замечаний:</strong> ${v.tasks.filter(t => t.conclusion && t.conclusion !== 'ok').length}</p>`;

      for (let ti = 0; ti < v.tasks.length; ti++) {
        sectionsHtml += await renderTask(v.tasks[ti], ti + 1, recMap, simplified);
      }

      sectionsHtml += '</div>';
    }
    sectionsHtml += '</div>';
  }

  if (!sectionsHtml) {
    sectionsHtml = '<p style="text-align:center;color:#999;font-size:14pt;margin:40px 0;">Нет данных за выбранный период</p>';
  }

  const simplifiedWarning = simplified
    ? `<p style="color:#faad14;font-size:9pt;text-align:center;">⚠ Отчёт сформирован в упрощённом режиме: превью фотографий заменены текстовыми ссылками (${totalPhotos} фото). Фотографии доступны в отдельном архиве.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>${reportTitle}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin: 20px; }
  h1 { text-align: center; font-size: 18pt; }
  h2 { color: #333; margin-top: 20px; font-size: 14pt; }
  h3 { color: #444; font-size: 12pt; }
  table { width: 100%; border-collapse: collapse; }
  .stats { display: flex; gap: 12px; margin: 16px 0; }
  .stat-box { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; text-align: center; }
  .stat-value { font-size: 20pt; font-weight: bold; }
  .stat-label { font-size: 8pt; color: #666; }
  .title-page { text-align: center; padding: 60px 20px; }
  .title-page h1 { font-size: 22pt; margin-bottom: 20px; }
  .title-page p { font-size: 12pt; color: #555; margin: 8px 0; }
  .meta { font-size: 9pt; color: #999; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; }
</style>
</head>
<body>
  <div class="title-page">
    <h1>${reportTitle}</h1>
    <p>${subtitle}</p>
    <p style="margin-top:30px;"><strong>Дата формирования:</strong> ${new Date().toLocaleDateString('ru-RU')}</p>
    <p><strong>Сформировал:</strong> ${generatedBy.fullName} (${roleLabel})</p>
    ${simplifiedWarning}
  </div>

  <div class="stats">
    <div class="stat-box"><div class="stat-value">${totalVisits}</div><div class="stat-label">Визитов</div></div>
    <div class="stat-box"><div class="stat-value">${totalTasks}</div><div class="stat-label">Задач</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#faad14;">${totalIssues}</div><div class="stat-label">Замечаний</div></div>
    <div class="stat-box"><div class="stat-value">${byAddress.size}</div><div class="stat-label">Объектов</div></div>
  </div>

  ${sectionsHtml}

  <div class="meta">
    <p>Отчёт сформирован: ${new Date().toLocaleString('ru-RU')}</p>
  </div>
</body>
</html>`;
}
