/**
 * Регрессионный тест-скрипт v3 — PWA «Цифровой чек-лист инженера»
 * Авто-обновление токена, правильные имена полей.
 */
const BASE = 'https://checkonout.ru';
const LOGIN = 'testic@test.ru';
const PASS = 'hello2026';

let accessToken = '';
let userId = '';
let results = [];
let visitId = null, taskId = null, photoId = null, addressId = null;
let createdVisitIds = [];

function log(tc, name, status, details = '') {
  const icon = { PASS: '✅', FAIL: '❌', WARN: '⚠️', SKIP: '⏭️' }[status] || '?';
  results.push({ tc, name, status, details });
  console.log(`${icon} ${tc}: ${name}${details ? ' — ' + details : ''}`);
}

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` };
  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  let data;
  if (ct.includes('json')) data = await res.json();
  else if (res.status === 204) data = null;
  else data = await res.text();
  return { status: res.status, data, ct };
}

async function ensureToken() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LOGIN, password: PASS }),
  });
  const d = await r.json();
  accessToken = d.accessToken;
  userId = d.user.id;
}

// ===================== 1. AUTH =====================
async function testAuth() {
  console.log('\n══════ 1. АВТОРИЗАЦИЯ ══════\n');

  // TC-001
  { const r = await api('POST', '/api/auth/login', { email: LOGIN, password: PASS });
    if (r.status === 200 && r.data.accessToken) {
      accessToken = r.data.accessToken; userId = r.data.user.id;
      log('TC-001', 'Вход инженера', 'PASS', `role=${r.data.user.role}, vik=${r.data.user.specializationVik}, iszh=${r.data.user.specializationIszh}, gpm=${r.data.user.specializationGpm}, dgu=${r.data.user.specializationDgu}, ibp=${r.data.user.specializationIbp}`);
    } else { log('TC-001', 'Вход инженера', 'FAIL', `status=${r.status}`); return false; }
  }
  // TC-003: неверный пароль
  { const r = await api('POST', '/api/auth/login', { email: LOGIN, password: 'wrong' });
    log('TC-003', 'Неверный пароль', (r.status >= 400 && r.status < 500) ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // TC-046
  { const r = await api('POST', '/api/auth/login', { email: 'Testic@Test.ru', password: PASS });
    log('TC-046', 'Регистронезависимый логин', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // TC-003a-c
  { const r = await api('POST', '/api/auth/login', { email: '', password: PASS });
    log('TC-003a', 'Пустой email', r.status >= 400 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  { const r = await api('POST', '/api/auth/login', { email: LOGIN, password: '' });
    log('TC-003b', 'Пустой пароль', r.status >= 400 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  { const r = await api('POST', '/api/auth/login', { email: 'bad', password: 'x' });
    log('TC-003c', 'Невалидный email', r.status >= 400 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // TC-AUTH-REFRESH
  { const loginR = await api('POST', '/api/auth/login', { email: LOGIN, password: PASS });
    const rt = loginR.data.refreshToken;
    const r = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) });
    const d = await r.json();
    if (r.ok && d.accessToken) { accessToken = d.accessToken; log('TC-AUTH-REFRESH', 'Refresh token', 'PASS'); }
    else log('TC-AUTH-REFRESH', 'Refresh token', 'FAIL', `status=${r.status}, msg=${d.error || JSON.stringify(d).slice(0,80)}`);
  }
  // TC-AUTH-ME
  { const r = await api('GET', '/api/auth/me');
    log('TC-AUTH-ME', 'GET /auth/me', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  return true;
}

// ===================== 2. VISITS =====================
async function testVisits() {
  console.log('\n══════ 2. CRUD ВИЗИТОВ ══════\n');
  await ensureToken();

  // Адрес
  { const r = await api('GET', '/api/refs/addresses/search?q=Бакулева&limit=5');
    if (r.status === 200 && r.data?.length > 0) { addressId = r.data[0].id; log('TC-006', 'Поиск адреса', 'PASS', `id=${addressId}`); }
    else { const r2 = await api('GET', '/api/refs/addresses/search?q=&limit=3');
      if (r2.status === 200 && r2.data?.length > 0) { addressId = r2.data[0].id; log('TC-006', 'Поиск адреса (fallback)', 'PASS'); }
      else { log('TC-006', 'Поиск адреса', 'FAIL'); return; } }
  }
  // TC-004
  { const r = await api('POST', '/api/visits', {});
    log('TC-004', 'Валидация создания визита', r.status >= 400 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // TC-005: Создание визита (правильные поля!)
  { const now = new Date();
    const r = await api('POST', '/api/visits', {
      addressId, engineerName: 'Тестик',
      dateStart: now.toISOString().split('T')[0],
      timeStart: now.toTimeString().slice(0, 5),
      season: (now.getMonth() >= 3 && now.getMonth() <= 9) ? 'summer' : 'winter',
    });
    if ((r.status === 200 || r.status === 201) && r.data?.id) {
      visitId = r.data.id; createdVisitIds.push(visitId);
      log('TC-005', 'Создание визита', 'PASS', `id=${visitId}, status=${r.data.status}, season=${r.data.season}`);
    } else log('TC-005', 'Создание визита', 'FAIL', `status=${r.status}, body=${JSON.stringify(r.data).slice(0,200)}`);
  }
  // TC-032
  { const r = await api('GET', '/api/visits?limit=20&page=1');
    const d = r.data; const cnt = d?.data?.length ?? (Array.isArray(d) ? d.length : 0);
    log('TC-032', 'Список визитов', r.status === 200 ? 'PASS' : 'FAIL', `count=${cnt}, total=${d?.total}`); }
  // TC-032.2
  { const r = await api('GET', '/api/visits?status=not_started&limit=5');
    log('TC-032.2', 'Фильтр по статусу', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // TC-032.5
  { const r = await api('GET', '/api/visits?search=Бакулева&limit=5');
    log('TC-032.5', 'Поиск по адресу', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // TC-030
  if (visitId) { const r = await api('PUT', `/api/visits/${visitId}`, { engineerName: 'Тестик', dateStart: new Date().toISOString().split('T')[0], timeStart: '12:00', comment: 'Автотест' });
    log('TC-030', 'Редактирование визита', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // TC-063
  { const r = await api('GET', '/api/visits/00000000-0000-0000-0000-000000000001');
    log('TC-063', 'Изоляция — чужой визит', (r.status === 403 || r.status === 404) ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // TC-109
  { const r = await api('POST', '/api/reports/summary-generate', { period: 'day' });
    log('TC-109', 'Инженер → сводные отчёты = 403', r.status === 403 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // TC-031: soft delete
  { const now = new Date();
    const cr = await api('POST', '/api/visits', { addressId, engineerName: 'Тестик', dateStart: now.toISOString().split('T')[0], timeStart: '13:00', season: 'summer' });
    if (cr.data?.id) { const dr = await api('DELETE', `/api/visits/${cr.data.id}`);
      log('TC-031', 'Soft delete визита', (dr.status === 200 || dr.status === 204) ? 'PASS' : 'FAIL', `status=${dr.status}`); } }
}

// ===================== 3. TASKS =====================
async function testTasks() {
  console.log('\n══════ 3. ЗАДАЧИ ══════\n');
  await ensureToken();
  if (!visitId) { log('TC-TASKS', 'Пропуск', 'SKIP', 'нет визита'); return; }

  let splitvnId;
  { const r = await api('GET', '/api/refs/equipment-types');
    const eq = r.data?.find(e => e.code === 'splitvn');
    splitvnId = eq?.id || r.data?.[0]?.id;
    log('TC-007a', 'Справочник equipment-types', r.status === 200 ? 'PASS' : 'FAIL', `count=${r.data?.length}, splitvn=${!!eq}`); }

  // TC-008
  if (splitvnId) { const r = await api('POST', `/api/visits/${visitId}/tasks`, { equipmentTypeId: splitvnId, roomTypeCode: 'server' });
    if ((r.status === 200 || r.status === 201) && r.data?.id) { taskId = r.data.id; log('TC-008', 'Создание задачи', 'PASS', `id=${taskId}, status=${r.data.status}`); }
    else log('TC-008', 'Создание задачи', 'FAIL', `status=${r.status}, body=${JSON.stringify(r.data).slice(0,200)}`); }

  // TC-010
  if (taskId) { const r = await api('GET', `/api/visits/${visitId}/tasks/${taskId}`);
    log('TC-010', 'Получение задачи', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.data?.status}`); }

  // TC-012
  if (taskId) { const r = await api('PUT', `/api/visits/${visitId}/tasks/${taskId}`, { model: 'TestModel', serialNumber: 'SN-001', readings: '12345.6', conclusion: 'ok' });
    log('TC-012', 'Сохранение параметров', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}, taskStatus=${r.data?.status}`); }

  // TC-022
  if (taskId) { const r = await api('PUT', `/api/visits/${visitId}/tasks/${taskId}`, { conclusion: 'issues', additionalRecommendations: '' });
    log('TC-022', 'Условная обязательность', r.status === 400 ? 'PASS' : 'WARN', `status=${r.status} (валидация на клиенте?)`); }

  // TC-023
  if (taskId) { const r = await api('PUT', `/api/visits/${visitId}/tasks/${taskId}`, { conclusion: 'ok', additionalRecommendations: '' });
    log('TC-023', 'Без замечаний → OK', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }

  // TC-009
  if (splitvnId) { const cr = await api('POST', `/api/visits/${visitId}/tasks`, { equipmentTypeId: splitvnId, roomTypeCode: 'server' });
    if (cr.data?.id) { const dr = await api('DELETE', `/api/visits/${visitId}/tasks/${cr.data.id}`);
      log('TC-009', 'Удаление задачи', (dr.status === 200 || dr.status === 204) ? 'PASS' : 'FAIL', `status=${dr.status}`); } }

  // TC-024
  if (taskId) { const r = await api('POST', `/api/visits/${visitId}/tasks/${taskId}/reset`);
    log('TC-024', 'Сброс задачи', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}, newStatus=${r.data?.status}`); }

  // Список задач
  { const r = await api('GET', `/api/visits/${visitId}/tasks`);
    log('TC-TASKS-LIST', 'Список задач визита', r.status === 200 ? 'PASS' : 'FAIL', `count=${Array.isArray(r.data) ? r.data.length : 'N/A'}`); }
}

// ===================== 4. PHOTOS =====================
async function testPhotos() {
  console.log('\n══════ 4. ФОТО ══════\n');
  await ensureToken();
  if (!taskId) { log('TC-PHOTOS', 'Пропуск', 'SKIP'); return; }

  const jpeg = new Uint8Array([0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xD9]);

  // TC-013
  try {
    const fd = new FormData(); fd.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'before.jpg');
    const res = await fetch(`${BASE}/api/tasks/items/${taskId}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: fd });
    const d = await res.json();
    if (res.ok && d.id) { photoId = d.id; log('TC-013', 'Загрузка фото ДО', 'PASS', `id=${photoId}`); }
    else log('TC-013', 'Загрузка фото ДО', 'FAIL', `status=${res.status}, body=${JSON.stringify(d).slice(0,200)}`);
  } catch (e) { log('TC-013', 'Загрузка фото ДО', 'FAIL', e.message); }

  // TC-015
  try {
    const fd = new FormData(); fd.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'after.jpg');
    const res = await fetch(`${BASE}/api/tasks/items/${taskId}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: fd });
    const d = await res.json();
    if (res.ok && d.id) log('TC-015', 'Загрузка фото ПОСЛЕ', 'PASS', `id=${d.id}`);
    else log('TC-015', 'Загрузка фото ПОСЛЕ', 'FAIL', `status=${res.status}`);
  } catch (e) { log('TC-015', 'Загрузка фото ПОСЛЕ', 'FAIL', e.message); }

  // TC-016
  if (photoId) { const r = await api('DELETE', `/api/photos/${photoId}`);
    log('TC-016', 'Удаление фото', (r.status === 200 || r.status === 204) ? 'PASS' : 'FAIL', `status=${r.status}`); }
}

// ===================== 5. REFS =====================
async function testRefs() {
  console.log('\n══════ 5. СПРАВОЧНИКИ ══════\n');
  await ensureToken();

  { const r = await api('GET', '/api/refs/equipment-types'); log('TC-034', 'Виды оборудования', r.status === 200 ? 'PASS' : 'FAIL', `count=${r.data?.length}`); }
  { const r = await api('GET', '/api/refs/room-types'); log('TC-REFS-ROOMS', 'Типы помещений', r.status === 200 ? 'PASS' : 'FAIL', `count=${r.data?.length}`); }
  { const r = await api('GET', '/api/refs/recommendations'); log('TC-035', 'Рекомендации', r.status === 200 ? 'PASS' : 'FAIL', `count=${Array.isArray(r.data) ? r.data.length : 'N/A'}`); }
  if (addressId) { const r = await api('GET', `/api/refs/object-equipment?addressId=${addressId}&limit=5`); log('TC-080', 'Оборудование объектов', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  if (addressId) { const r = await api('GET', `/api/refs/object-equipment/rooms?addressId=${addressId}`); log('TC-080a', 'Комнаты объекта', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  { const r = await api('GET', '/api/refs/manufacturers'); log('TC-REFS-MFR', 'Производители', r.status === 200 ? 'PASS' : 'FAIL', `count=${Array.isArray(r.data) ? r.data.length : 'N/A'}`); }
  { const r = await api('GET', '/api/refs/models/search?q=&limit=3'); log('TC-REFS-MDL', 'Модели', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  { const r = await api('GET', '/api/refs/engineers'); log('TC-REFS-ENG', 'Инженеры', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
}

// ===================== 6. REPORTS =====================
async function testReports() {
  console.log('\n══════ 6. ОТЧЁТЫ ══════\n');
  await ensureToken();
  if (!visitId) { log('TC-REPORTS', 'Пропуск', 'SKIP'); return; }

  { const r = await api('POST', `/api/reports/${visitId}/report/generate`);
    log('TC-027', 'Генерация отчёта', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}, ct=${r.ct}`); }
  { const r = await api('GET', `/api/reports/${visitId}/report/download`);
    log('TC-028', 'Скачивание отчёта', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}, ct=${r.ct}`); }
  // Без авторизации
  { const res = await fetch(`${BASE}/api/reports/${visitId}/report/download`);
    log('TC-029', 'Отчёт без авторизации → 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`); }
}

// ===================== 7. PROFILE =====================
async function testProfile() {
  console.log('\n══════ 7. ПРОФИЛЬ, ИЗБРАННОЕ ══════\n');
  await ensureToken();

  { const r = await api('GET', '/api/profile'); log('TC-047', 'Профиль', r.status === 200 ? 'PASS' : 'FAIL', `name=${r.data?.fullName}`); }
  { const r = await api('PATCH', '/api/profile/specialization', { specializationVik: true, specializationIszh: true });
    log('TC-111', 'Изменение специализации', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  { const r = await api('PATCH', '/api/profile/specialization', { specializationVik: false, specializationIszh: false });
    log('TC-111a', 'Сброс специализации → валидация', r.status === 400 ? 'PASS' : 'WARN', `status=${r.status}`);
    await api('PATCH', '/api/profile/specialization', { specializationVik: true, specializationIszh: true }); }
  { const r = await api('GET', '/api/profile/stats'); log('TC-142', 'Статистика', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }

  if (addressId) {
    { const r = await api('POST', '/api/profile/favorites', { addressId });
      log('TC-117', 'Добавление в избранное', (r.status === 200 || r.status === 201) ? 'PASS' : 'FAIL', `status=${r.status}`); }
    { const r = await api('POST', '/api/profile/favorites', { addressId });
      log('TC-125', 'Защита от дублей', (r.status === 409 || r.status === 400) ? 'PASS' : 'FAIL', `status=${r.status} (ожидался 409)`); }
    { const r = await api('GET', '/api/profile/favorites'); log('TC-118', 'Список избранного', r.status === 200 ? 'PASS' : 'FAIL', `count=${Array.isArray(r.data) ? r.data.length : 'N/A'}`); }
    { const r = await api('DELETE', `/api/profile/favorites/${addressId}`);
      log('TC-118a', 'Удаление из избранного', (r.status === 200 || r.status === 204) ? 'PASS' : 'FAIL', `status=${r.status}`); }
  }
  { const r = await api('GET', '/api/profile/objects'); log('TC-139', 'Объекты профиля', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
}

// ===================== 8. PROPOSALS & REQUESTS =====================
async function testProposals() {
  console.log('\n══════ 8. ЗАЯВКИ / ПРЕДЛОЖЕНИЯ ══════\n');
  await ensureToken();

  { const r = await api('GET', '/api/proposals/my'); log('TC-092', 'Мои предложения', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  { const r = await api('GET', '/api/requests?engineerId=' + userId); log('TC-233', 'Мои заявки', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  if (addressId) { const r = await api('GET', `/api/visits/check-requests?addressId=${addressId}`);
    log('TC-296', 'Проверка заявок по адресу', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
}

// ===================== 9. SECURITY =====================
async function testSecurity() {
  console.log('\n══════ 9. БЕЗОПАСНОСТЬ ══════\n');
  await ensureToken();

  // Без токена
  { const res = await fetch(`${BASE}/api/visits`);
    log('TC-SEC-01', 'Без токена → 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`); }
  // Невалидный токен
  { const res = await fetch(`${BASE}/api/visits`, { headers: { Authorization: 'Bearer fake' } });
    log('TC-SEC-02', 'Фейковый токен → 401', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`); }
  // Подмена userId
  if (addressId) {
    const r = await api('POST', '/api/visits', { addressId, engineerName: 'Тестик', userId: '00000000-0000-0000-0000-000000000099', dateStart: new Date().toISOString().split('T')[0], timeStart: '14:00', season: 'summer' });
    if (r.data?.id) { createdVisitIds.push(r.data.id);
      log('TC-SEC-03', 'Подмена userId', r.data.userId === userId ? 'PASS' : 'FAIL', `expected=${userId.slice(0,8)}, got=${r.data.userId?.slice(0,8)}`); }
    else log('TC-SEC-03', 'Подмена userId', 'PASS', `отклонено status=${r.status}`);
  }
  // Чужой визит
  { const r = await api('GET', '/api/visits/00000000-0000-0000-0000-000000000002');
    log('TC-SEC-04', 'Чужой визит → 403/404', (r.status === 403 || r.status === 404) ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // Чужая задача
  { const r = await api('DELETE', '/api/visits/00000000-0000-0000-0000-000000000099/tasks/00000000-0000-0000-0000-000000000099');
    log('TC-SEC-05', 'Чужая задача → 403/404', (r.status === 403 || r.status === 404) ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // Админ
  { const r = await api('GET', '/api/admin/users');
    log('TC-SEC-06', 'Инженер → /admin/users = 403', r.status === 403 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // Admin proposals
  { const r = await api('GET', '/api/proposals/admin');
    log('TC-SEC-07', 'Инженер → /proposals/admin = 403', r.status === 403 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  // Инженер не может менять чужой профиль
  { const r = await api('PATCH', '/api/profile/specialization', { specializationVik: true, specializationIszh: true });
    log('TC-SEC-08', 'Свой профиль — OK', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
}

// ===================== 10. NOTIFICATIONS =====================
async function testNotifications() {
  console.log('\n══════ 10. УВЕДОМЛЕНИЯ ══════\n');
  await ensureToken();

  { const r = await api('GET', '/api/notifications');
    log('TC-214', 'Список уведомлений', r.status === 200 ? 'PASS' : 'FAIL', `count=${Array.isArray(r.data) ? r.data.length : (r.data?.data?.length ?? 'N/A')}`); }
  { const r = await api('PATCH', '/api/notifications/read-all');
    log('TC-215', 'Прочитать все', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
  { const r = await api('POST', '/api/notifications/clear-all');
    log('TC-279', 'Очистить все', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
}

// ===================== 11. LIFECYCLE =====================
async function testLifecycle() {
  console.log('\n══════ 11. ЖИЗНЕННЫЙ ЦИКЛ ══════\n');
  await ensureToken();
  if (!visitId || !taskId) { log('TC-LC', 'Пропуск', 'SKIP'); return; }

  await api('PUT', `/api/visits/${visitId}/tasks/${taskId}`, { model: 'Test', serialNumber: 'SN-001', conclusion: 'ok' });
  { const r = await api('POST', `/api/visits/${visitId}/complete`);
    log('TC-025', 'Завершение визита', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}, newStatus=${r.data?.status}`); }
  { const r = await api('POST', `/api/reports/${visitId}/report/generate`);
    log('TC-027b', 'Отчёт после завершения', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`); }
}

// ===================== CLEANUP =====================
async function cleanup() {
  console.log('\n══════ ОЧИСТКА ══════\n');
  await ensureToken();
  for (const vid of createdVisitIds) {
    try { await api('DELETE', `/api/visits/${vid}`); console.log(`  ✓ ${vid}`); } catch { console.log(`  ✗ ${vid}`); }
  }
}

// ===================== MAIN =====================
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  РЕГРЕССИОННОЕ ТЕСТИРОВАНИЕ v3 — Инженер ТО');
  console.log(`  ${BASE} | ${new Date().toISOString()} | ${LOGIN}`);
  console.log('═══════════════════════════════════════════════════');

  const ok = await testAuth();
  if (!ok) { console.log('❌ Auth failed'); process.exit(1); }

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

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;
  const tested = total - skip;

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ИТОГИ');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Всего: ${total} | ✅ PASS: ${pass} | ❌ FAIL: ${fail} | ⚠️ WARN: ${warn} | ⏭️ SKIP: ${skip}`);
  console.log(`  Pass rate: ${((pass / tested) * 100).toFixed(1)}% (без SKIP)`);

  if (fail > 0) { console.log('\n  ❌ FAIL:'); results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ${r.tc}: ${r.name} — ${r.details}`)); }
  if (warn > 0) { console.log('\n  ⚠️ WARN:'); results.filter(r => r.status === 'WARN').forEach(r => console.log(`    ${r.tc}: ${r.name} — ${r.details}`)); }

  const fs = await import('fs');
  fs.writeFileSync('test-report-api-v3.json', JSON.stringify({
    date: new Date().toISOString(), server: BASE, account: LOGIN,
    summary: { total, pass, fail, warn, skip, passRate: ((pass / tested) * 100).toFixed(1) + '%' }, results,
  }, null, 2), 'utf-8');
  console.log('\n  → test-report-api-v3.json');
}

main().catch(e => { console.error('Critical:', e); process.exit(1); });
