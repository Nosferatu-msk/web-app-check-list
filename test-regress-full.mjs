/**
 * Расширенный регрессионный тест — PWA «Цифровой чек-лист инженера»
 * Роль: Инженер ТО (testic@test.ru / hello2026)
 * Цель: 100+ тестов, акцент на валидацию данных и бизнес-логику.
 */
const BASE = 'https://checkonout.ru';
const LOGIN = 'testic@test.ru';
const PASS = 'hello2026';

let T = ''; // access token
let UID = '';
let R = []; // results
let visitId = null, taskId = null, taskId2 = null, addressId = null;
let createdVisitIds = [];

function log(tc, name, status, details = '') {
  R.push({ tc, name, status, details });
  const i = { PASS: '✅', FAIL: '❌', WARN: '⚠️', SKIP: '⏭️' }[status];
  console.log(`${i} ${tc}: ${name}${details ? ' — ' + details : ''}`);
}

async function api(m, p, b) {
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` };
  const o = { method: m, headers: h };
  if (b && m !== 'GET') o.body = JSON.stringify(b);
  try {
    const r = await fetch(`${BASE}${p}`, o);
    const ct = r.headers.get('content-type') || '';
    let d;
    try { d = ct.includes('json') ? await r.json() : (await r.text()).slice(0, 300); } catch { d = null; }
    return { s: r.status, d, ct };
  } catch (e) {
    return { s: 0, d: null, ct: '', err: e.message };
  }
}

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: LOGIN, password: PASS }) });
  const d = await r.json();
  T = d.accessToken; UID = d.user.id;
  return d;
}

// ===================== 1. AUTH (10 тестов) =====================
async function testAuth() {
  console.log('\n══════ 1. АВТОРИЗАЦИЯ (10) ══════\n');
  const d = await login();

  // 1. Успешный вход
  log('TC-001', 'Вход инженера', d.accessToken ? 'PASS' : 'FAIL', `role=${d.user.role}`);
  // 2. Структура ответа
  const fields = ['id','fullName','email','role','isActive','specializationVik','specializationIszh','specializationGpm','specializationDgu','specializationIbp'];
  const missing = fields.filter(f => d.user[f] === undefined);
  log('TC-001a', 'Полнота ответа user', missing.length === 0 ? 'PASS' : 'FAIL', missing.length ? `missing: ${missing}` : 'все поля');
  // 3. Наличие токенов
  log('TC-001b', 'Наличие accessToken+refreshToken', (d.accessToken && d.refreshToken) ? 'PASS' : 'FAIL');
  // 4. Специализации
  log('TC-001c', 'Специализации testic', 'PASS', `vik=${d.user.specializationVik}, iszh=${d.user.specializationIszh}, gpm=${d.user.specializationGpm}, dgu=${d.user.specializationDgu}, ibp=${d.user.specializationIbp}`);

  // 5. Неверный пароль
  { const r = await api('POST', '/api/auth/login', { email: LOGIN, password: 'wrong' });
    log('TC-003', 'Неверный пароль → 4xx', r.s >= 400 && r.s < 500 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 6. Пустой email
  { const r = await api('POST', '/api/auth/login', { email: '', password: PASS });
    log('TC-003a', 'Пустой email → 4xx', r.s >= 400 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 7. Пустой пароль
  { const r = await api('POST', '/api/auth/login', { email: LOGIN, password: '' });
    log('TC-003b', 'Пустой пароль → 4xx', r.s >= 400 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 8. Регистронезависимый
  { const r = await api('POST', '/api/auth/login', { email: 'TESTIC@TEST.RU', password: PASS });
    log('TC-046', 'Регистронезависимый логин', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 9. GET /auth/me
  { const r = await api('GET', '/api/auth/me');
    log('TC-001d', 'GET /auth/me', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 10. Refresh token
  { const ld = await login();
    const r = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: ld.refreshToken }) });
    const rd = await r.json().catch(() => ({}));
    log('TC-010-auth', 'Refresh token', r.ok && rd.accessToken ? 'PASS' : 'FAIL', `status=${r.status}, err=${rd.error || 'none'}`);
    if (rd.accessToken) T = rd.accessToken; else await login(); }
}

// ===================== 2. VISITS (15 тестов) =====================
async function testVisits() {
  console.log('\n══════ 2. ВИЗИТЫ (15) ══════\n');
  await login();

  // Поиск адреса
  { const r = await api('GET', '/api/refs/addresses/search?q=Бакулева&limit=5');
    if (r.s === 200 && r.d?.length > 0) { addressId = r.d[0].id; log('TC-006', 'Поиск адреса', 'PASS', `id=${addressId}`); }
    else { const r2 = await api('GET', '/api/refs/addresses/search?q=&limit=3');
      if (r2.s === 200 && r2.d?.length > 0) { addressId = r2.d[0].id; log('TC-006', 'Поиск адреса (fallback)', 'PASS'); }
      else { log('TC-006', 'Поиск адреса', 'FAIL'); return; } } }

  // 1. Валидация — пустое тело
  { const r = await api('POST', '/api/visits', {});
    log('TC-004', 'Валидация: пустое тело → 400', r.s === 400 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 2. Валидация — нет engineerName
  { const r = await api('POST', '/api/visits', { addressId, dateStart: '2026-09-14', timeStart: '10:00', season: 'summer' });
    log('TC-004a', 'Валидация: нет engineerName', r.s >= 400 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 3. Валидация — нет addressId
  { const r = await api('POST', '/api/visits', { engineerName: 'Тест', dateStart: '2026-09-14', timeStart: '10:00', season: 'summer' });
    log('TC-004b', 'Валидация: нет addressId', r.s >= 400 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 4. Валидация — невалидный season
  { const r = await api('POST', '/api/visits', { addressId, engineerName: 'Тест', dateStart: '2026-09-14', timeStart: '10:00', season: 'autumn' });
    log('TC-004c', 'Валидация: season=autumn → 400', r.s >= 400 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 5. Создание визита
  { const now = new Date();
    const r = await api('POST', '/api/visits', { addressId, engineerName: 'Тестик', dateStart: now.toISOString().split('T')[0], timeStart: now.toTimeString().slice(0,5), season: 'summer' });
    if ((r.s === 200 || r.s === 201) && r.d?.id) { visitId = r.d.id; createdVisitIds.push(visitId);
      log('TC-005', 'Создание визита', 'PASS', `id=${visitId}, status=${r.d.status}, season=${r.d.season}`); }
    else log('TC-005', 'Создание визита', 'FAIL', `status=${r.s}, body=${JSON.stringify(r.d).slice(0,200)}`); }
  // 6. Дубликат визита (тот же адрес)
  { const now = new Date();
    const r = await api('POST', '/api/visits', { addressId, engineerName: 'Тестик', dateStart: now.toISOString().split('T')[0], timeStart: now.toTimeString().slice(0,5), season: 'summer' });
    log('TC-005a', 'Дубликат визита → existingVisit', r.s === 200 && r.d?.existingVisit === true ? 'PASS' : 'WARN', `status=${r.s}, existing=${r.d?.existingVisit}`);
    if (r.d?.id && r.d.id !== visitId) createdVisitIds.push(r.d.id); }
  // 7. Список визитов
  { const r = await api('GET', '/api/visits?limit=20&page=1');
    log('TC-032', 'Список визитов', r.s === 200 ? 'PASS' : 'FAIL', `total=${r.d?.total}, shown=${r.d?.data?.length}`); }
  // 8. Фильтр по статусу
  { const r = await api('GET', '/api/visits?status=not_started&limit=5');
    log('TC-032a', 'Фильтр по статусу', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 9. Поиск по адресу
  { const r = await api('GET', '/api/visits?search=Бакулева&limit=5');
    log('TC-032b', 'Поиск по адресу', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 10. globalStats
  { const r = await api('GET', '/api/visits?limit=1');
    const gs = r.d?.globalStats;
    log('TC-032c', 'globalStats в ответе', gs ? 'PASS' : 'FAIL', gs ? `total=${gs.total}, planned=${gs.planned}, ip=${gs.inProgress}, completed=${gs.completed}` : 'нет'); }
  // 11. Редактирование визита (PUT)
  if (visitId) { const r = await api('PUT', `/api/visits/${visitId}`, { engineerName: 'Тестик', dateStart: new Date().toISOString().split('T')[0], timeStart: '12:00', comment: 'Автотест' });
    log('TC-030', 'Редактирование визита', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 12. Изоляция — чужой визит
  { const r = await api('GET', '/api/visits/00000000-0000-0000-0000-000000000001');
    log('TC-063', 'Чужой визит → 404', (r.s === 403 || r.s === 404) ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 13. Soft delete
  { const now = new Date();
    const cr = await api('POST', '/api/visits', { addressId, engineerName: 'Тестик', dateStart: now.toISOString().split('T')[0], timeStart: '13:00', season: 'summer' });
    if (cr.d?.id) { const dr = await api('DELETE', `/api/visits/${cr.d.id}`);
      log('TC-031', 'Soft delete визита', (dr.s === 200 || dr.s === 204) ? 'PASS' : 'FAIL', `status=${dr.s}`); } }
  // 14. Подмена userId
  { const r = await api('POST', '/api/visits', { addressId, engineerName: 'Тестик', userId: '00000000-0000-0000-0000-000000000099', dateStart: new Date().toISOString().split('T')[0], timeStart: '14:00', season: 'summer' });
    if (r.d?.id) { createdVisitIds.push(r.d.id);
      log('TC-SEC-03', 'Подмена userId → игнор', r.d.userId === UID ? 'PASS' : 'FAIL', `expected=${UID.slice(0,8)}, got=${r.d.userId?.slice(0,8)}`); }
    else log('TC-SEC-03', 'Подмена userId → отклонено', 'PASS', `status=${r.s}`); }
  // 15. Детали визита
  if (visitId) { const r = await api('GET', `/api/visits/${visitId}`);
    log('TC-005b', 'Детали визита (GET :id)', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}, tasks=${r.d?.tasks?.length}`); }
}

// ===================== 3. TASKS (20 тестов) =====================
async function testTasks() {
  console.log('\n══════ 3. ЗАДАЧИ (20) ══════\n');
  await login();
  if (!visitId) { log('TC-TASKS', 'Пропуск', 'SKIP', 'нет визита'); return; }

  // Получить все типы оборудования
  let types = [];
  { const r = await api('GET', '/api/refs/equipment-types');
    if (r.s === 200) { types = r.d; log('TC-007a', 'Справочник equipment-types', 'PASS', `count=${types.length}`); } }

  const splitvn = types.find(e => e.code === 'splitvn');
  const rsch = types.find(e => e.code === 'rsch');
  const dgu = types.find(e => e.code === 'dgu');
  const ibp = types.find(e => e.code === 'ibp');
  const lift = types.find(e => e.code === 'lift_pass');
  const boiler = types.find(e => e.code === 'boiler_gas');
  const coffee = types.find(e => e.code === 'coffee');
  const splitnar = types.find(e => e.code === 'splitnar');

  // 1. Создание задачи (splitvn)
  if (splitvn) { const r = await api('POST', `/api/visits/${visitId}/tasks`, { equipmentTypeId: splitvn.id, roomTypeCode: 'server' });
    if ((r.s === 200 || r.s === 201) && r.d?.id) { taskId = r.d.id; log('TC-008', 'Создание задачи (splitvn)', 'PASS', `id=${taskId}, status=${r.d.status}`); }
    else log('TC-008', 'Создание задачи (splitvn)', 'FAIL', `status=${r.s}`); }

  // 2. Создание задачи (rsch — ИСЖ)
  if (rsch) { const r = await api('POST', `/api/visits/${visitId}/tasks`, { equipmentTypeId: rsch.id, roomTypeCode: 'electroshc' });
    if ((r.s === 200 || r.s === 201) && r.d?.id) { taskId2 = r.d.id; log('TC-008a', 'Создание задачи (rsch)', 'PASS', `id=${taskId2}`); }
    else log('TC-008a', 'Создание задачи (rsch)', 'FAIL', `status=${r.s}`); }

  // 3. Создание задачи (dgu)
  if (dgu) { const r = await api('POST', `/api/visits/${visitId}/tasks`, { equipmentTypeId: dgu.id, roomTypeCode: 'server' });
    log('TC-008b', 'Создание задачи (dgu)', (r.s === 200 || r.s === 201) ? 'PASS' : 'FAIL', `status=${r.s}`);
    if (r.d?.id) createdVisitIds.push(r.d.id); /* track for cleanup */ }

  // 4. Создание задачи (ibp)
  if (ibp) { const r = await api('POST', `/api/visits/${visitId}/tasks`, { equipmentTypeId: ibp.id, roomTypeCode: 'server' });
    log('TC-008c', 'Создание задачи (ibp)', (r.s === 200 || r.s === 201) ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 5. Создание задачи (lift_pass)
  if (lift) { const r = await api('POST', `/api/visits/${visitId}/tasks`, { equipmentTypeId: lift.id, roomTypeCode: 'kpp' });
    log('TC-008d', 'Создание задачи (lift_pass)', (r.s === 200 || r.s === 201) ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 6. Создание задачи (boiler_gas)
  if (boiler) { const r = await api('POST', `/api/visits/${visitId}/tasks`, { equipmentTypeId: boiler.id, roomTypeCode: 'teplovoj_uzel' });
    log('TC-008e', 'Создание задачи (boiler_gas)', (r.s === 200 || r.s === 201) ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 7. Создание задачи (coffee)
  if (coffee) { const r = await api('POST', `/api/visits/${visitId}/tasks`, { equipmentTypeId: coffee.id, roomTypeCode: 'kassovaya' });
    log('TC-008f', 'Создание задачи (coffee)', (r.s === 200 || r.s === 201) ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 8. Валидация — нет equipmentTypeId
  { const r = await api('POST', `/api/visits/${visitId}/tasks`, { roomTypeCode: 'server' });
    log('TC-008g', 'Валидация: нет equipmentTypeId', r.s >= 400 ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 9. Валидация — невалидный equipmentTypeId
  { const r = await api('POST', `/api/visits/${visitId}/tasks`, { equipmentTypeId: '00000000-0000-0000-0000-000000000099' });
    log('TC-008h', 'Валидация: фейковый equipmentTypeId', r.s >= 400 ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 10. Получение задачи
  if (taskId) { const r = await api('GET', `/api/visits/${visitId}/tasks/${taskId}`);
    log('TC-010', 'Получение задачи', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.d?.status}, type=${r.d?.taskType}`); }

  // 11. Сохранение параметров
  if (taskId) { const r = await api('PUT', `/api/visits/${visitId}/tasks/${taskId}`, { model: 'TestModel', serialNumber: 'SN-001', readings: '12345.6', conclusion: 'ok' });
    log('TC-012', 'Сохранение параметров', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}, taskStatus=${r.d?.status}`); }

  // 12. Сохранение с conclusion=ok_with_notes + recommendations
  if (taskId) { const r = await api('PUT', `/api/visits/${visitId}/tasks/${taskId}`, { conclusion: 'ok_with_notes', additionalRecommendations: 'Замена фильтра' });
    log('TC-022a', 'conclusion=ok_with_notes + рекомендации', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 13. BUG-CHECK: conclusion=ok_with_notes БЕЗ recommendations
  if (taskId) { const r = await api('PUT', `/api/visits/${visitId}/tasks/${taskId}`, { conclusion: 'ok_with_notes', additionalRecommendations: '' });
    log('TC-022b', 'BUG: conclusion=ok_with_notes без рекомендаций', r.s === 400 ? 'PASS (валидирует)' : 'FAIL (БАГ — пропускает!)', `status=${r.s}`); }

  // 14. BUG-CHECK: conclusion=faulty БЕЗ recommendations
  if (taskId) { const r = await api('PUT', `/api/visits/${visitId}/tasks/${taskId}`, { conclusion: 'faulty', additionalRecommendations: '' });
    log('TC-022c', 'BUG: conclusion=faulty без рекомендаций', r.s === 400 ? 'PASS (валидирует)' : 'FAIL (БАГ — пропускает!)', `status=${r.s}`); }

  // 15. conclusion=ok без рекомендаций — OK
  if (taskId) { const r = await api('PUT', `/api/visits/${visitId}/tasks/${taskId}`, { conclusion: 'ok', additionalRecommendations: '' });
    log('TC-023', 'conclusion=ok без рекомендаций → OK', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 16. Список задач визита
  { const r = await api('GET', `/api/visits/${visitId}/tasks`);
    const cnt = Array.isArray(r.d) ? r.d.length : 0;
    log('TC-TASKS-LIST', 'Список задач визита', r.s === 200 ? 'PASS' : 'FAIL', `count=${cnt}`); }

  // 17. Сброс задачи
  if (taskId) { const r = await api('POST', `/api/visits/${visitId}/tasks/${taskId}/reset`);
    log('TC-024', 'Сброс задачи', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}, newStatus=${r.d?.status}`); }

  // 18. Удаление задачи
  if (taskId2) { const r = await api('DELETE', `/api/visits/${visitId}/tasks/${taskId2}`);
    log('TC-009', 'Удаление задачи', (r.s === 200 || r.s === 204) ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 19. Статус визита после создания задачи → in_progress
  if (visitId) { const r = await api('GET', `/api/visits/${visitId}`);
    log('TC-005c', 'Статус визита → in_progress после задачи', r.d?.status === 'in_progress' ? 'PASS' : 'WARN', `status=${r.d?.status}`); }

  // 20. Чужая задача — доступ
  { const r = await api('DELETE', `/api/visits/00000000-0000-0000-0000-000000000099/tasks/00000000-0000-0000-0000-000000000099`);
    log('TC-SEC-05', 'Чужая задача → 403/404', (r.s === 403 || r.s === 404) ? 'PASS' : 'FAIL', `status=${r.s}`); }
}

// ===================== 4. PHOTOS (8 тестов) =====================
async function testPhotos() {
  console.log('\n══════ 4. ФОТО (8) ══════\n');
  await login();
  if (!taskId) { log('TC-PH', 'Пропуск', 'SKIP'); return; }

  const jpeg = new Uint8Array([0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xD9]);

  // 1. Загрузка фото ДО
  let photoId1;
  try {
    const fd = new FormData(); fd.append('photo', new Blob([jpeg], {type:'image/jpeg'}), 'before.jpg');
    const res = await fetch(`${BASE}/api/tasks/${taskId}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${T}` }, body: fd });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.id) { photoId1 = d.id; log('TC-013', 'Загрузка фото ДО', 'PASS', `id=${photoId1}`); }
    else log('TC-013', 'Загрузка фото ДО', 'FAIL', `status=${res.status}, body=${JSON.stringify(d).slice(0,200)}`);
  } catch (e) { log('TC-013', 'Загрузка фото ДО', 'FAIL', e.message); }

  // 2. Загрузка фото ПОСЛЕ
  let photoId2;
  try {
    const fd = new FormData(); fd.append('photo', new Blob([jpeg], {type:'image/jpeg'}), 'after.jpg');
    const res = await fetch(`${BASE}/api/tasks/${taskId}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${T}` }, body: fd });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.id) { photoId2 = d.id; log('TC-015', 'Загрузка фото ПОСЛЕ', 'PASS', `id=${photoId2}`); }
    else log('TC-015', 'Загрузка фото ПОСЛЕ', 'FAIL', `status=${res.status}`);
  } catch (e) { log('TC-015', 'Загрузка фото ПОСЛЕ', 'FAIL', e.message); }

  // 3. Список фото задачи
  { const r = await api('GET', `/api/tasks/${taskId}/photos`);
    log('TC-013a', 'Список фото задачи', r.s === 200 ? 'PASS' : 'FAIL', `count=${Array.isArray(r.d) ? r.d.length : 'N/A'}`); }

  // 4. Удаление фото
  if (photoId2) { const r = await api('DELETE', `/api/photos/${photoId2}`);
    log('TC-016', 'Удаление фото', (r.s === 200 || r.s === 204) ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 5. Загрузка без авторизации
  try {
    const fd = new FormData(); fd.append('photo', new Blob([jpeg], {type:'image/jpeg'}), 'x.jpg');
    const res = await fetch(`${BASE}/api/tasks/${taskId}/photos`, { method: 'POST', body: fd });
    log('TC-SEC-PH1', 'Загрузка фото без токена → 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
  } catch (e) { log('TC-SEC-PH1', 'Загрузка фото без токена', 'FAIL', e.message); }

  // 6. Замена фото (upsert — повторная загрузка того же moment)
  try {
    const fd = new FormData(); fd.append('photo', new Blob([jpeg], {type:'image/jpeg'}), 'before2.jpg');
    const res = await fetch(`${BASE}/api/tasks/${taskId}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${T}` }, body: fd });
    const d = await res.json().catch(() => ({}));
    log('TC-013b', 'Замена фото (upsert)', res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
  } catch (e) { log('TC-013b', 'Замена фото', 'FAIL', e.message); }

  // 7. Удаление без авторизации
  if (photoId1) { const res = await fetch(`${BASE}/api/photos/${photoId1}`, { method: 'DELETE' });
    log('TC-SEC-PH2', 'Удаление фото без токена → 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`); }

  // 8. Очистка — удаление оставшихся фото
  { const r = await api('GET', `/api/tasks/${taskId}/photos`);
    if (Array.isArray(r.d)) { for (const p of r.d) { await api('DELETE', `/api/photos/${p.id}`); } } }
}

// ===================== 5. REFS (12 тестов) =====================
async function testRefs() {
  console.log('\n══════ 5. СПРАВОЧНИКИ (12) ══════\n');
  await login();

  { const r = await api('GET', '/api/refs/equipment-types'); log('TC-034', 'Виды оборудования', r.s === 200 ? 'PASS' : 'FAIL', `count=${r.d?.length}`); }
  { const r = await api('GET', '/api/refs/room-types'); log('TC-REF-01', 'Типы помещений', r.s === 200 ? 'PASS' : 'FAIL', `count=${r.d?.length}`); }
  { const r = await api('GET', '/api/refs/recommendations'); log('TC-035', 'Рекомендации (все)', r.s === 200 ? 'PASS' : 'FAIL', `count=${Array.isArray(r.d) ? r.d.length : 'N/A'}`); }

  // Фильтрация рекомендаций
  { const types = await api('GET', '/api/refs/equipment-types');
    if (types.d?.length > 0) { const r = await api('GET', `/api/refs/recommendations?equipment_type_id=${types.d[0].id}`);
      log('TC-035a', 'Рекомендации по типу оборудования', r.s === 200 ? 'PASS' : 'FAIL', `count=${Array.isArray(r.d) ? r.d.length : 'N/A'}`); } }

  if (addressId) { const r = await api('GET', `/api/refs/object-equipment?addressId=${addressId}&limit=5`);
    log('TC-080', 'Оборудование объектов', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  if (addressId) { const r = await api('GET', `/api/refs/object-equipment/rooms?addressId=${addressId}`);
    log('TC-080a', 'Комнаты объекта', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  if (addressId) { const r = await api('GET', `/api/refs/object-equipment/other-rooms?addressId=${addressId}&current_room_type_code=server`);
    log('TC-293', 'Оборудование из других помещений', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }

  { const r = await api('GET', '/api/refs/manufacturers'); log('TC-REF-02', 'Производители', r.s === 200 ? 'PASS' : 'FAIL', `count=${Array.isArray(r.d) ? r.d.length : 'N/A'}`); }
  { const r = await api('GET', '/api/refs/models/search?q=&limit=5'); log('TC-REF-03', 'Модели (поиск)', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  { const r = await api('GET', '/api/refs/engineers'); log('TC-REF-04', 'Инженеры', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // Поиск адресов — инженер видит только адреса своего ТМ
  { const r = await api('GET', '/api/refs/addresses/search?q=Тверская&limit=5');
    log('TC-REF-05', 'Поиск адресов (инженер)', r.s === 200 ? 'PASS' : 'FAIL', `count=${r.d?.length}`); }
  // Пустой поиск
  { const r = await api('GET', '/api/refs/addresses/search?q=&limit=3');
    log('TC-REF-06', 'Поиск адресов (пустой)', r.s === 200 ? 'PASS' : 'FAIL', `count=${r.d?.length}`); }
}

// ===================== 6. REPORTS (5 тестов) =====================
async function testReports() {
  console.log('\n══════ 6. ОТЧЁТЫ (5) ══════\n');
  await login();
  if (!visitId) { log('TC-REP', 'Пропуск', 'SKIP'); return; }

  { const r = await api('POST', `/api/reports/${visitId}/report/generate`);
    log('TC-027', 'Генерация отчёта', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  { const r = await api('GET', `/api/reports/${visitId}/report/download`);
    log('TC-028', 'Скачивание отчёта', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}, ct=${r.ct}`); }
  // Без авторизации
  { const res = await fetch(`${BASE}/api/reports/${visitId}/report/download`);
    log('TC-029', 'Отчёт без токена → 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`); }
  // Инженер → сводный отчёт
  { const r = await api('POST', '/api/reports/summary-generate', { type: 'period', dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    log('TC-109', 'Инженер → сводный отчёт = 403', r.s === 403 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // Несуществующий визит
  { const r = await api('POST', '/api/reports/00000000-0000-0000-0000-000000000099/report/generate');
    log('TC-REP-05', 'Отчёт по чужому визиту', (r.s === 403 || r.s === 404) ? 'PASS' : 'FAIL', `status=${r.s}`); }
}

// ===================== 7. PROFILE (10 тестов) =====================
async function testProfile() {
  console.log('\n══════ 7. ПРОФИЛЬ (10) ══════\n');
  await login();

  { const r = await api('GET', '/api/profile'); log('TC-047', 'Получение профиля', r.s === 200 ? 'PASS' : 'FAIL', `name=${r.d?.fullName}`); }
  { const r = await api('PATCH', '/api/profile/specialization', { specializationVik: true, specializationIszh: true });
    log('TC-111', 'Изменение специализации', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // Сброс обеих → валидация
  { const r = await api('PATCH', '/api/profile/specialization', { specializationVik: false, specializationIszh: false, specializationGpm: false, specializationDgu: false, specializationIbp: false });
    log('TC-111a', 'Сброс всех специализаций → 400', r.s === 400 ? 'PASS' : 'WARN', `status=${r.s}`);
    await api('PATCH', '/api/profile/specialization', { specializationVik: true, specializationIszh: true }); }
  // Добавление специализации
  { const r = await api('PATCH', '/api/profile/specialization', { specializationVik: true, specializationIszh: true, specializationGpm: true });
    log('TC-111b', 'Добавление специализации (gpm)', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`);
    await api('PATCH', '/api/profile/specialization', { specializationVik: true, specializationIszh: true, specializationGpm: false }); }

  { const r = await api('GET', '/api/profile/stats'); log('TC-142', 'Статистика', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }

  if (addressId) {
    { const r = await api('POST', '/api/profile/favorites', { addressId });
      log('TC-117', 'Добавление в избранное', (r.s === 200 || r.s === 201) ? 'PASS' : 'FAIL', `status=${r.s}`); }
    { const r = await api('POST', '/api/profile/favorites', { addressId });
      log('TC-125', 'Дубликат избранного', (r.s === 409 || r.s === 400) ? 'PASS' : 'FAIL', `status=${r.s} (ожид. 409)`); }
    { const r = await api('GET', '/api/profile/favorites');
      log('TC-118', 'Список избранного', r.s === 200 ? 'PASS' : 'FAIL', `count=${Array.isArray(r.d) ? r.d.length : 'N/A'}`); }
    { const r = await api('DELETE', `/api/profile/favorites/${addressId}`);
      log('TC-118a', 'Удаление из избранного', (r.s === 200 || r.s === 204) ? 'PASS' : 'FAIL', `status=${r.s}`); }
  }
  { const r = await api('GET', '/api/profile/objects'); log('TC-139', 'Объекты профиля', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
}

// ===================== 8. PROPOSALS & REQUESTS (5 тестов) =====================
async function testProposals() {
  console.log('\n══════ 8. ЗАЯВКИ/ПРЕДЛОЖЕНИЯ (5) ══════\n');
  await login();

  { const r = await api('GET', '/api/proposals/my'); log('TC-092', 'Мои предложения', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  { const r = await api('GET', '/api/requests?engineerId=' + UID); log('TC-233', 'Мои заявки', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  if (addressId) { const r = await api('GET', `/api/visits/check-requests?addressId=${addressId}`);
    log('TC-296', 'Проверка заявок по адресу', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // Инженер → admin proposals
  { const r = await api('GET', '/api/proposals/admin');
    log('TC-SEC-08', 'Инженер → /proposals/admin = 403', r.s === 403 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // Поиск заявок по номерам
  { const r = await api('POST', '/api/requests/search-by-numbers', { externalRequestIds: ['IS000000001'] });
    log('TC-REQ-05', 'Поиск заявок по номерам', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
}

// ===================== 9. SECURITY (10 тестов) =====================
async function testSecurity() {
  console.log('\n══════ 9. БЕЗОПАСНОСТЬ (10) ══════\n');

  // 1. Без токена → 401
  { const res = await fetch(`${BASE}/api/visits`);
    log('TC-SEC-01', 'Без токена → 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`); }
  // 2. Фейковый токен
  { const res = await fetch(`${BASE}/api/visits`, { headers: { Authorization: 'Bearer fake' } });
    log('TC-SEC-02', 'Фейковый токен → 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`); }
  // 3. Админ-роуты
  await login();
  { const r = await api('GET', '/api/admin/users');
    log('TC-SEC-06', 'Инженер → /admin/users = 403', r.s === 403 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 4. Админ — адреса
  { const r = await api('GET', '/api/admin/addresses');
    log('TC-SEC-06a', 'Инженер → /admin/addresses = 403', r.s === 403 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 5. Админ — оборудование
  { const r = await api('GET', '/api/admin/equipment-types');
    log('TC-SEC-06b', 'Инженер → /admin/equipment-types = 403', r.s === 403 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 6. Админ — аудит
  { const r = await api('GET', '/api/admin/audit-log');
    log('TC-SEC-06c', 'Инженер → /admin/audit-log = 403', r.s === 403 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 7. Импорт
  { const r = await api('GET', '/api/admin/import/addresses');
    log('TC-SEC-06d', 'Инженер → /admin/import = 403/404', (r.s === 403 || r.s === 404) ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 8. Contracts
  { const r = await api('GET', '/api/contracts');
    log('TC-SEC-09', 'Инженер → /contracts', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s} (может быть разрешён)`); }
  // 9. Чужой профиль
  { const r = await api('GET', '/api/visits/00000000-0000-0000-0000-000000000002');
    log('TC-SEC-04', 'Чужой визит → 404', (r.s === 403 || r.s === 404) ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // 10. System webhook без подписи
  { const r = await api('POST', '/api/system/webhook/deploy', { version: 'v999', release_notes: 'test' });
    log('TC-SEC-10', 'Webhook без подписи → 401/403', (r.s === 401 || r.s === 403) ? 'PASS' : 'FAIL', `status=${r.s}`); }
}

// ===================== 10. NOTIFICATIONS (5 тестов) =====================
async function testNotifications() {
  console.log('\n══════ 10. УВЕДОМЛЕНИЯ (5) ══════\n');
  await login();

  { const r = await api('GET', '/api/notifications'); log('TC-214', 'Список уведомлений', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  { const r = await api('PATCH', '/api/notifications/read-all'); log('TC-215', 'Прочитать все', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  { const r = await api('POST', '/api/notifications/clear-all'); log('TC-279', 'Очистить все', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
  // Без токена
  { const res = await fetch(`${BASE}/api/notifications`);
    log('TC-SEC-N1', 'Уведомления без токена → 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`); }
  // Фильтр unread
  { const r = await api('GET', '/api/notifications?unread_only=true&limit=5');
    log('TC-214a', 'Фильтр unread_only', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }
}

// ===================== 11. LIFECYCLE (5 тестов) =====================
async function testLifecycle() {
  console.log('\n══════ 11. ЖИЗНЕННЫЙ ЦИКЛ (5) ══════\n');
  await login();
  if (!visitId || !taskId) { log('TC-LC', 'Пропуск', 'SKIP'); return; }

  // Заполнить задачу
  await api('PUT', `/api/visits/${visitId}/tasks/${taskId}`, { model: 'Test', serialNumber: 'SN-001', conclusion: 'ok' });

  // 1. Завершение визита
  { const r = await api('POST', `/api/visits/${visitId}/complete`);
    log('TC-025', 'Завершение визита', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}, newStatus=${r.d?.status}`); }

  // 2. Отчёт после завершения
  { const r = await api('POST', `/api/reports/${visitId}/report/generate`);
    log('TC-027b', 'Отчёт после завершения', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 3. Скачивание после завершения
  { const r = await api('GET', `/api/reports/${visitId}/report/download`);
    log('TC-028b', 'Скачивание после завершения', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 4. Редактирование завершённого визита
  { const r = await api('PUT', `/api/visits/${visitId}`, { engineerName: 'Тестик', dateStart: new Date().toISOString().split('T')[0], timeStart: '15:00' });
    log('TC-030a', 'Редактирование завершённого визита', r.s === 200 ? 'PASS' : 'FAIL', `status=${r.s}`); }

  // 5. Создание нового визита для очистки
  { const now = new Date();
    const r = await api('POST', '/api/visits', { addressId, engineerName: 'Тестик', dateStart: now.toISOString().split('T')[0], timeStart: '16:00', season: 'summer' });
    if (r.d?.id) createdVisitIds.push(r.d.id);
    log('TC-LC-05', 'Создание визита для очистки', r.d?.id ? 'PASS' : 'FAIL', `status=${r.s}`); }
}

// ===================== CLEANUP =====================
async function cleanup() {
  console.log('\n══════ ОЧИСТКА ══════\n');
  await login();
  for (const vid of createdVisitIds) {
    try { await api('DELETE', `/api/visits/${vid}`); console.log(`  ✓ ${vid}`); } catch { console.log(`  ✗ ${vid}`); }
  }
}

// ===================== MAIN =====================
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  РАСШИРЕННОЕ ТЕСТИРОВАНИЕ — Инженер ТО');
  console.log(`  ${BASE} | ${new Date().toISOString()} | ${LOGIN}`);
  console.log('═══════════════════════════════════════════════════');

  await testAuth();
  await testVisits();
  await testTasks();
  await testPhotos();
  await testRefs();
  await testReports();
  await testProfile();
  await testProposals();
  await testSecurity();
  await testNotifications();
  await testLifecycle();
  await cleanup();

  const pass = R.filter(r => r.status === 'PASS').length;
  const fail = R.filter(r => r.status === 'FAIL').length;
  const warn = R.filter(r => r.status === 'WARN').length;
  const skip = R.filter(r => r.status === 'SKIP').length;
  const total = R.length;
  const tested = total - skip;

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ИТОГИ');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Всего: ${total} | ✅ PASS: ${pass} | ❌ FAIL: ${fail} | ⚠️ WARN: ${warn} | ⏭️ SKIP: ${skip}`);
  console.log(`  Pass rate: ${((pass / tested) * 100).toFixed(1)}% (без SKIP)`);

  if (fail > 0) { console.log('\n  ❌ FAIL:'); R.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ${r.tc}: ${r.name} — ${r.details}`)); }
  if (warn > 0) { console.log('\n  ⚠️ WARN:'); R.filter(r => r.status === 'WARN').forEach(r => console.log(`    ${r.tc}: ${r.name} — ${r.details}`)); }

  const fs = await import('fs');
  fs.writeFileSync('test-report-full.json', JSON.stringify({
    date: new Date().toISOString(), server: BASE, account: LOGIN,
    summary: { total, pass, fail, warn, skip, passRate: ((pass / tested) * 100).toFixed(1) + '%' }, results: R,
  }, null, 2), 'utf-8');
  console.log('\n  → test-report-full.json');
}

main().catch(e => { console.error('Critical:', e); process.exit(1); });
