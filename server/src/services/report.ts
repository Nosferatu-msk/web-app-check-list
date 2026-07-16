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

export function sanitizeFileName(str: string): string {
  return str.replace(/[^a-zA-Zа-яА-Я0-9_\-]/g, '_').replace(/_+/g, '_');
}

export function buildReportFileName(visit: { address: { street: string; house: string }; dateStart: Date }) {
  const street = sanitizeFileName(visit.address.street.replace(/\s/g, ''));
  const house = sanitizeFileName(visit.address.house);
  const date = formatDate(visit.dateStart).replace(/\./g, '-');
  return `OTCHET_${street}_${house}_${date}`;
}
