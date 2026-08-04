import fs from 'fs';
import path from 'path';
import prisma from '../models/prisma.js';
import { sanitizeFileName } from './report.js';

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function photoToBase64(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (fs.existsSync(resolved)) {
    const buf = fs.readFileSync(resolved);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }
  return '';
}

export function buildMtrReportFileName(visit: { requestNumber: string; address: { street?: string; house?: string }; dateStart: Date }) {
  const rn = sanitizeFileName(visit.requestNumber);
  const date = formatDate(visit.dateStart).replace(/\./g, '-');
  return `MTR_${rn}_${date}`;
}

export async function generateMtrReportHtml(mtrVisitId: string): Promise<string> {
  const visit = await prisma.mtrVisit.findUnique({
    where: { id: mtrVisitId },
    include: {
      engineer: true,
      address: true,
      works: {
        orderBy: { sortOrder: 'asc' },
        include: { mtrWorkType: true },
      },
      photos: true,
    },
  });

  if (!visit) throw new Error('Визит МТР не найден');

  const photosBefore = visit.photos.filter(p => p.moment === 'before');
  const photosAfter = visit.photos.filter(p => p.moment === 'after');

  const worksRows = visit.works.map((w, i) => `
    <tr>
      <td style="border:1px solid #ccc;padding:6px;text-align:center;">${i + 1}</td>
      <td style="border:1px solid #ccc;padding:6px;">${w.mtrWorkType?.name || '—'}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center;">${w.quantity}</td>
      <td style="border:1px solid #ccc;padding:6px;">${w.comment || '—'}</td>
    </tr>
  `).join('');

  const renderPhotos = (photos: typeof visit.photos) => {
    if (photos.length === 0) return '<p style="color:#999;">Нет фото</p>';
    return photos.map(p => {
      const src = photoToBase64(p.filePath);
      return src
        ? `<img src="${src}" style="max-width:300px;max-height:220px;margin:4px;border:1px solid #ddd;border-radius:4px;" />`
        : `<p style="color:#999;">${p.fileName} (файл не найден)</p>`;
    }).join('');
  };

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 0; padding: 20px; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 15px; margin: 18px 0 8px; border-bottom: 2px solid #1677ff; padding-bottom: 4px; color: #1677ff; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .info-table td { padding: 4px 8px; vertical-align: top; }
  .info-table .label { color: #888; width: 160px; }
  .info-table .value { font-weight: 600; }
  table.works { width: 100%; border-collapse: collapse; }
  table.works th { background: #f0f5ff; border: 1px solid #ccc; padding: 6px; font-weight: 600; text-align: center; }
  .photos-block { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .signature { margin-top: 30px; display: flex; justify-content: space-between; }
  .signature-line { border-bottom: 1px solid #333; width: 200px; display: inline-block; }
</style>
</head>
<body>

<h1>АКТ ВЫПОЛНЕННЫХ РАБОТ</h1>
<p style="text-align:center;color:#666;margin-top:0;">Мелкий текущий ремонт (МТР)</p>

<h2>Общие сведения</h2>
<table class="info-table">
  <tr><td class="label">Номер заявки:</td><td class="value">${visit.requestNumber}</td></tr>
  <tr><td class="label">Адрес:</td><td class="value">${visit.address?.fullAddress || '—'}</td></tr>
  <tr><td class="label">Дата:</td><td class="value">${formatDate(visit.dateStart)}</td></tr>
  <tr><td class="label">Время:</td><td class="value">${visit.timeStart}</td></tr>
  <tr><td class="label">Инженер:</td><td class="value">${visit.engineer?.fullName || '—'}</td></tr>
  <tr><td class="label">Статус:</td><td class="value">${visit.status === 'completed' ? 'Завершён' : visit.status}</td></tr>
</table>

<h2>Выполненные работы</h2>
<table class="works">
  <thead>
    <tr>
      <th style="width:40px;">№</th>
      <th>Наименование работы</th>
      <th style="width:60px;">Кол-во</th>
      <th style="width:180px;">Комментарий</th>
    </tr>
  </thead>
  <tbody>
    ${worksRows || '<tr><td colspan="4" style="text-align:center;padding:12px;color:#999;">Нет работ</td></tr>'}
  </tbody>
</table>

<h2>Фотофиксация</h2>

<h3 style="font-size:14px;margin:12px 0 4px;">Фото ДО</h3>
<div class="photos-block">
  ${renderPhotos(photosBefore)}
</div>

<h3 style="font-size:14px;margin:12px 0 4px;">Фото ПОСЛЕ</h3>
<div class="photos-block">
  ${renderPhotos(photosAfter)}
</div>

<div class="signature">
  <div>Инженер: <span class="signature-line">&nbsp;</span> ${visit.engineer?.fullName || ''}</div>
  <div>Дата: <span class="signature-line">&nbsp;${formatDate(visit.dateStart)}&nbsp;</span></div>
</div>

</body>
</html>`;
}
