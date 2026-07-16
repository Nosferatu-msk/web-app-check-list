import prisma from '../models/prisma.js';
import fs from 'fs';
import path from 'path';

const CONCLUSION_MAP: Record<string, string> = {
  ok: 'Исправно, замечаний нет',
  ok_with_notes: 'Исправно, есть замечания',
  faulty: 'Неисправно',
};

const SEASON_MAP: Record<string, string> = {
  summer: 'Лето',
  winter: 'Зима',
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

function formatBool(val: unknown): string {
  return val ? 'Да' : 'Нет';
}

function formatParamValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return formatBool(val);
  if (val === 'satisfactory') return 'Удовлетворительно';
  if (val === 'unsatisfactory') return 'Неудовлетворительно';
  if (val === 'clean') return 'Чистый';
  if (val === 'needs_replacement') return 'Требует замены';
  if (val === 'needs_cleaning') return 'Необходима очистка';
  if (val === 'on') return 'Включена';
  if (val === 'off') return 'Выключена';
  if (key === 'readings' || key === 'cooling_capacity_kw' || key === 'room_temperature' || key === 'temperature_before' || key === 'temperature_after' || key === 'heating_temperature') {
    return String(val);
  }
  return String(val);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export async function generateReportHtml(visitId: string): Promise<string> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      address: true,
      tasks: {
        orderBy: { sortOrder: 'asc' },
        include: { equipmentType: true, roomType: true, photos: true },
      },
    },
  });
  if (!visit) throw new Error('Вizit not found');

  const recommendations = await prisma.recommendation.findMany({ where: { isActive: true } });
  const recMap = new Map(recommendations.map(r => [r.id, r.text]));

  // Fetch engineer's specialization
  const visitUser = await prisma.user.findUnique({
    where: { id: visit.userId },
    select: { specializationVik: true, specializationIszh: true },
  });
  let specializationLabel = '';
  if (visitUser) {
    if (visitUser.specializationVik && visitUser.specializationIszh) {
      specializationLabel = 'ВиК + ИСЖ';
    } else if (visitUser.specializationVik) {
      specializationLabel = 'ВиК';
    } else if (visitUser.specializationIszh) {
      specializationLabel = 'ИСЖ';
    }
  }

  let tasksHtml = '';
  for (let i = 0; i < visit.tasks.length; i++) {
    const task = visit.tasks[i];
    const params = (task.parameters || {}) as Record<string, unknown>;
    let paramsHtml = '';
    for (const [key, val] of Object.entries(params)) {
      if (key === 'conclusion' || key === 'selected_recommendations' || key === 'additional_recommendations') continue;
      const label = PARAM_LABELS[key] || key;
      paramsHtml += `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${label}</td><td style="padding:4px 8px;border:1px solid #ddd;">${formatParamValue(key, val)}</td></tr>`;
    }

    let photosHtml = '';
    for (const photo of task.photos) {
      const photoPath = path.resolve(photo.filePath);
      let photoData = '';
      if (fs.existsSync(photoPath)) {
        const buf = fs.readFileSync(photoPath);
        photoData = `data:image/jpeg;base64,${buf.toString('base64')}`;
      }
      photosHtml += `<div style="margin:8px 0;"><strong>[ФОТО] ${photo.fileName}</strong><br><img src="${photoData}" style="max-width:400px;max-height:300px;" /></div>`;
    }

    const selectedRecs = (task.selectedRecommendationIds || []).map(id => recMap.get(id)).filter(Boolean);
    let recsHtml = '';
    for (const r of selectedRecs) {
      recsHtml += `<li>${r}</li>`;
    }
    if (task.additionalRecommendations) {
      recsHtml += `<li>${task.additionalRecommendations}</li>`;
    }

    const location = task.roomType ? task.roomType.name : (task.comment || '—');
    const title = `${i + 1}. ${task.equipmentType.name}${task.comment ? ` (${task.comment})` : ''}`;

    tasksHtml += `
      <div style="margin:20px 0;padding:15px;border:1px solid #ccc;border-radius:4px;">
        <h3 style="margin:0 0 10px;">${title}</h3>
        <p><strong>📍 Местоположение:</strong> ${location}</p>
        <p><strong>🔧 Контролируемые параметры:</strong></p>
        <table style="width:100%;border-collapse:collapse;margin:8px 0;">${paramsHtml}</table>
        <p><strong>📸 Фотофиксация:</strong></p>
        ${photosHtml}
        <p><strong>✅ Заключение:</strong> ${task.conclusion ? CONCLUSION_MAP[task.conclusion] || task.conclusion : '—'}</p>
        ${recsHtml ? `<p><strong>📊 Рекомендации:</strong></p><ul>${recsHtml}</ul>` : ''}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Акт выполненных работ</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin: 20px; }
  h1 { text-align: center; }
  h3 { color: #333; }
  table { width: 100%; }
</style>
</head>
<body>
  <h1>АКТЫ ВЫПОЛНЕННЫХ РАБОТ</h1>
  <div style="margin:20px 0;">
    <h3>Общие сведения:</h3>
    <hr/>
    <p><strong>Адрес объекта:</strong> ${visit.address.fullAddress}</p>
    <p><strong>Дата проведения:</strong> ${formatDate(visit.dateStart)}</p>
    <p><strong>Время начала:</strong> ${visit.timeStart}</p>
    <p><strong>Время окончания:</strong> ${visit.timeEnd || '—'}</p>
    <p><strong>Сезон:</strong> ${SEASON_MAP[visit.season] || visit.season}</p>
    <p><strong>Инженер:</strong> ${visit.engineerName}</p>
    ${specializationLabel ? `<p><strong>Специализация:</strong> ${specializationLabel}</p>` : ''}
    <hr/>
  </div>
  ${tasksHtml}
  <div style="margin-top:40px;">
    <p><strong>ПОДПИСЬ ИНЖЕНЕРА:</strong> ____________ /${visit.engineerName}/</p>
  </div>
</body>
</html>`;
}

export async function generatePdf(html: string, outputPath: string) {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: outputPath, format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
  await browser.close();
}

// ─── SUMMARY REPORT ────────────────────────────────────────────

interface SummaryVisit {
  id: string;
  dateStart: Date;
  timeStart: string;
  timeEnd?: string | null;
  engineerName: string;
  status: string;
  address: { fullAddress: string };
  tasks: {
    id: string;
    conclusion?: string | null;
    equipmentType?: { name: string } | null;
    roomType?: { name: string } | null;
    comment?: string | null;
    parameters?: unknown;
    selectedRecommendationIds?: string[];
    additionalRecommendations?: string | null;
  }[];
}

const CONCLUSION_COLORS: Record<string, string> = {
  ok: '#52c41a',
  ok_with_notes: '#faad14',
  faulty: '#ff4d4f',
};

function conclusionBadge(conclusion?: string | null): string {
  const label = conclusion ? (CONCLUSION_MAP[conclusion] || conclusion) : '—';
  const color = conclusion ? (CONCLUSION_COLORS[conclusion] || '#999') : '#999';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;color:#fff;background:${color};font-size:10pt;">${label}</span>`;
}

function periodLabel(period: string): string {
  switch (period) {
    case 'day': return 'день';
    case 'week': return 'неделю';
    case 'month': return 'месяц';
    default: return period;
  }
}

export function generateSummaryReportHtml(
  visits: SummaryVisit[],
  period: string,
  dateRange: string,
  recMap?: Map<string, string>,
  engineerSpecialization?: string,
): string {
  const totalVisits = visits.length;
  const totalTasks = visits.reduce((s, v) => s + v.tasks.length, 0);
  const completedVisits = visits.filter(v => ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'].includes(v.status)).length;
  const visitsWithIssues = visits.filter(v => v.tasks.some(t => t.conclusion && t.conclusion !== 'ok')).length;

  // Collect all issues
  const issues: { visit: SummaryVisit; task: SummaryVisit['tasks'][0] }[] = [];
  for (const v of visits) {
    for (const t of v.tasks) {
      if (t.conclusion && t.conclusion !== 'ok') {
        issues.push({ visit: v, task: t });
      }
    }
  }

  let visitsRows = '';
  for (const v of visits) {
    const taskCount = v.tasks.length;
    const issueCount = v.tasks.filter(t => t.conclusion && t.conclusion !== 'ok').length;
    visitsRows += `
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;">${formatDate(v.dateStart)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${v.address.fullAddress}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${v.engineerName}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${taskCount}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${issueCount}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${conclusionBadge(v.tasks.some(t => t.conclusion === 'faulty') ? 'faulty' : v.tasks.some(t => t.conclusion === 'ok_with_notes') ? 'ok_with_notes' : 'ok')}</td>
      </tr>`;
  }

  let issuesRows = '';
  for (const { visit: v, task: t } of issues) {
    const equipName = t.equipmentType?.name || '—';
    const location = t.roomType?.name || (t.comment || '—');
    const selectedRecs = (t.selectedRecommendationIds || []).map(id => recMap?.get(id)).filter(Boolean);
    let recsText = selectedRecs.join('; ');
    if (t.additionalRecommendations) {
      recsText += (recsText ? '; ' : '') + t.additionalRecommendations;
    }
    issuesRows += `
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;">${formatDate(v.dateStart)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${v.address.fullAddress}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${v.engineerName}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${equipName}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${location}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${conclusionBadge(t.conclusion)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:9pt;">${recsText || '—'}</td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Сводный отчёт</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin: 20px; }
  h1 { text-align: center; }
  h2 { color: #333; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; }
  .stats { display: flex; gap: 16px; margin: 16px 0; }
  .stat-box { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 6px; text-align: center; }
  .stat-value { font-size: 24pt; font-weight: bold; }
  .stat-label { font-size: 9pt; color: #666; }
</style>
</head>
<body>
  <h1>СВОДНЫЙ ОТЧЁТ</h1>
  <p style="text-align:center;color:#666;">Период: ${periodLabel(period)} — ${dateRange}</p>
  ${engineerSpecialization ? `<p style="text-align:center;color:#666;">Специализация: ${engineerSpecialization}</p>` : ''}
  <hr/>

  <div class="stats">
    <div class="stat-box">
      <div class="stat-value">${totalVisits}</div>
      <div class="stat-label">Всего визитов</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${totalTasks}</div>
      <div class="stat-label">Всего задач</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color:#52c41a;">${completedVisits}</div>
      <div class="stat-label">Завершено</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color:#faad14;">${visitsWithIssues}</div>
      <div class="stat-label">С замечаниями</div>
    </div>
  </div>

  <h2>Детализация по визитам</h2>
  <table>
    <thead>
      <tr style="background:#fafafa;">
        <th style="padding:6px 8px;border:1px solid #ddd;">Дата</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Адрес</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Инженер</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Задач</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Замечаний</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Статус</th>
      </tr>
    </thead>
    <tbody>${visitsRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#999;border:1px solid #ddd;">Нет данных</td></tr>'}</tbody>
  </table>

  ${issues.length > 0 ? `
  <h2>Выявленные замечания</h2>
  <table>
    <thead>
      <tr style="background:#fafafa;">
        <th style="padding:6px 8px;border:1px solid #ddd;">Дата</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Адрес</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Инженер</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Оборудование</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Расположение</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Заключение</th>
        <th style="padding:6px 8px;border:1px solid #ddd;">Рекомендации</th>
      </tr>
    </thead>
    <tbody>${issuesRows}</tbody>
  </table>` : '<h2>Замечания</h2><p style="color:#52c41a;font-size:14pt;">Замечаний не выявлено</p>'}

  <div style="margin-top:40px;color:#999;font-size:9pt;">
    <p>Отчёт сформирован: ${new Date().toLocaleString('ru-RU')}</p>
  </div>
</body>
</html>`;
}

// ─── OBJECT REPORT ─────────────────────────────────────────────

interface ObjectVisit extends SummaryVisit {
  tasks: (SummaryVisit['tasks'][0] & {
    photos?: { fileName: string; filePath: string; moment: string }[];
  })[];
}

export function generateObjectReportHtml(
  visits: ObjectVisit[],
  address: { fullAddress: string },
  dateRange: string,
  recMap?: Map<string, string>,
): string {
  const totalVisits = visits.length;
  const totalTasks = visits.reduce((s, v) => s + v.tasks.length, 0);
  const totalIssues = visits.reduce((s, v) => s + v.tasks.filter(t => t.conclusion && t.conclusion !== 'ok').length, 0);

  let visitsHtml = '';
  for (let vi = 0; vi < visits.length; vi++) {
    const v = visits[vi];
    let tasksHtml = '';
    for (let ti = 0; ti < v.tasks.length; ti++) {
      const t = v.tasks[ti];
      const equipName = t.equipmentType?.name || '—';
      const location = t.roomType?.name || (t.comment || '—');
      const params = (t.parameters || {}) as Record<string, unknown>;

      let paramsHtml = '';
      for (const [key, val] of Object.entries(params)) {
        if (key === 'conclusion' || key === 'selected_recommendations' || key === 'additional_recommendations') continue;
        const label = PARAM_LABELS[key] || key;
        paramsHtml += `<tr><td style="padding:3px 6px;border:1px solid #ddd;font-size:9pt;">${label}</td><td style="padding:3px 6px;border:1px solid #ddd;font-size:9pt;">${formatParamValue(key, val)}</td></tr>`;
      }

      let photosHtml = '';
      for (const photo of (t.photos || [])) {
        photosHtml += `<span style="display:inline-block;margin:2px 4px;padding:2px 6px;background:#f0f0f0;border-radius:3px;font-size:8pt;">📷 ${photo.fileName} (${photo.moment === 'before' ? 'до' : 'после'})</span>`;
      }

      const selectedRecs = (t.selectedRecommendationIds || []).map(id => recMap?.get(id)).filter(Boolean);
      let recsHtml = '';
      for (const r of selectedRecs) { recsHtml += `<li style="font-size:9pt;">${r}</li>`; }
      if (t.additionalRecommendations) { recsHtml += `<li style="font-size:9pt;">${t.additionalRecommendations}</li>`; }

      tasksHtml += `
        <div style="margin:8px 0;padding:8px;border:1px solid #e0e0e0;border-radius:4px;">
          <div style="font-weight:600;">${ti + 1}. ${equipName}${t.comment ? ` (${t.comment})` : ''}</div>
          <div style="color:#666;font-size:9pt;">Расположение: ${location}</div>
          ${paramsHtml ? `<table style="width:100%;margin:4px 0;">${paramsHtml}</table>` : ''}
          ${photosHtml ? `<div style="margin:4px 0;">${photosHtml}</div>` : ''}
          <div>Заключение: ${conclusionBadge(t.conclusion)}</div>
          ${recsHtml ? `<ul style="margin:4px 0;">${recsHtml}</ul>` : ''}
        </div>`;
    }

    visitsHtml += `
      <div style="margin:16px 0;padding:12px;border:1px solid #ccc;border-radius:6px;">
        <h3 style="margin:0 0 8px;">Визит ${vi + 1}: ${formatDate(v.dateStart)}</h3>
        <p style="margin:4px 0;"><strong>Инженер:</strong> ${v.engineerName}</p>
        <p style="margin:4px 0;"><strong>Время:</strong> ${v.timeStart}${v.timeEnd ? ` — ${v.timeEnd}` : ''}</p>
        <p style="margin:4px 0;"><strong>Задач:</strong> ${v.tasks.length}, <strong>замечаний:</strong> ${v.tasks.filter(t => t.conclusion && t.conclusion !== 'ok').length}</p>
        ${tasksHtml}
      </div>`;
  }

  // Collect all issues across visits
  const allIssues: { visit: ObjectVisit; task: ObjectVisit['tasks'][0] }[] = [];
  for (const v of visits) {
    for (const t of v.tasks) {
      if (t.conclusion && t.conclusion !== 'ok') {
        allIssues.push({ visit: v, task: t });
      }
    }
  }

  let issuesSummaryHtml = '';
  if (allIssues.length > 0) {
    let issuesRows = '';
    for (const { visit: v, task: t } of allIssues) {
      const equipName = t.equipmentType?.name || '—';
      const location = t.roomType?.name || (t.comment || '—');
      issuesRows += `
        <tr>
          <td style="padding:4px 6px;border:1px solid #ddd;font-size:9pt;">${formatDate(v.dateStart)}</td>
          <td style="padding:4px 6px;border:1px solid #ddd;font-size:9pt;">${equipName}</td>
          <td style="padding:4px 6px;border:1px solid #ddd;font-size:9pt;">${location}</td>
          <td style="padding:4px 6px;border:1px solid #ddd;text-align:center;">${conclusionBadge(t.conclusion)}</td>
        </tr>`;
    }
    issuesSummaryHtml = `
      <h2>Свод замечаний за период</h2>
      <table>
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:4px 6px;border:1px solid #ddd;">Дата</th>
            <th style="padding:4px 6px;border:1px solid #ddd;">Оборудование</th>
            <th style="padding:4px 6px;border:1px solid #ddd;">Расположение</th>
            <th style="padding:4px 6px;border:1px solid #ddd;">Заключение</th>
          </tr>
        </thead>
        <tbody>${issuesRows}</tbody>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Отчёт по объекту</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin: 20px; }
  h1 { text-align: center; }
  h2 { color: #333; margin-top: 24px; }
  h3 { color: #444; }
  table { width: 100%; border-collapse: collapse; }
  .stats { display: flex; gap: 16px; margin: 16px 0; }
  .stat-box { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 6px; text-align: center; }
  .stat-value { font-size: 24pt; font-weight: bold; }
  .stat-label { font-size: 9pt; color: #666; }
</style>
</head>
<body>
  <h1>ОТЧЁТ ПО ОБЪЕКТУ</h1>
  <p style="text-align:center;font-size:13pt;"><strong>${address.fullAddress}</strong></p>
  <p style="text-align:center;color:#666;">Период: ${dateRange}</p>
  <hr/>

  <div class="stats">
    <div class="stat-box">
      <div class="stat-value">${totalVisits}</div>
      <div class="stat-label">Визитов</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${totalTasks}</div>
      <div class="stat-label">Задач</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color:#faad14;">${totalIssues}</div>
      <div class="stat-label">Замечаний</div>
    </div>
  </div>

  <h2>Визиты</h2>
  ${visitsHtml || '<p style="color:#999;">Нет визитов за указанный период</p>'}

  ${issuesSummaryHtml}

  <div style="margin-top:40px;color:#999;font-size:9pt;">
    <p>Отчёт сформирован: ${new Date().toLocaleString('ru-RU')}</p>
  </div>
</body>
</html>`;
}

export function sanitizeFileName(str: string): string {
  return str.replace(/[^a-zA-Zа-яА-Я0-9_\-]/g, '_').replace(/_+/g, '_');
}

export function buildReportFileName(visit: { address: { street: string; house: string }; dateStart: Date }) {
  const street = sanitizeFileName(visit.address.street.replace(/\s/g, ''));
  const house = sanitizeFileName(visit.address.house);
  const date = formatDate(visit.dateStart).replace(/\./g, '-');
  return `OTCHET_${street}_${house}_${date}`;
}
