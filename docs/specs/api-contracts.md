# API-контракты

## Содержание

- [4.1. Аутентификация](#41-аутентификация)
- [4.2. Справочники (Администратор)](#42-справочники-администратор)
  - [4.2.1. Массовый импорт (CSV / XLSX)](#421-массовый-импорт-csv--xlsx)
  - [4.2.2. Оборудование объектов](#422-оборудование-объектов)
- [4.3. Визиты и задачи (Инженер)](#43-визиты-и-задачи-инженер)
  - [4.3.1. Офлайн-методы (клиент)](#431-офлайн-методы-клиент)
  - [4.3.2. Визиты и задачи (ТМ)](#432-визиты-и-задачи-тм)
- [4.4. Отчёты](#44-отчёты)
- [4.5. Справочники (чтение для Инженера)](#45-справочники-чтение-для-инженера)
- [4.6. Синхронизация (офлайн → онлайн)](#46-синхронизация-офлайн--онлайн)
- [4.7. Личный кабинет и специализация](#47-личный-кабинет-и-специализация)
- [4.8. Маппинг специализаций](#48-маппинг-специализаций)
- [4.9. Уведомления](#49-уведомления)
- [4.10. Системные эндпоинты](#410-системные-эндпоинты)

### 4.1. Аутентификация

| Метод | Путь | Описание | Авторизация |
|-------|------|----------|:-----------:|
| POST | `/api/auth/login` | Вход (email + password) → JWT | Публичный |
| POST | `/api/auth/refresh` | Обновление access-токена | Refresh token |
| POST | `/api/auth/logout` | Инвалидация refresh-токена | Auth |
| GET | `/api/auth/me` | Текущий пользователь | Auth |
| POST | `/api/auth/forgot-password` | Запрос сброса пароля (отправка email) | Публичный |
| POST | `/api/auth/reset-password` | Сброс пароля по токену | Публичный |

**POST `/api/auth/login`**
```json
// Request
{ "email": "engineer@example.com", "password": "..." }

// Response 200
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "uuid",
    "full_name": "Иванов П.С.",
    "email": "engineer@example.com",
    "role": "engineer"
  }
}
```

### 4.2. Справочники (Администратор)

| Метод | Путь | Описание |
|-------|------|----------|
| **Адреса** | | |
| GET | `/api/admin/addresses` | Список адресов (пагинация, поиск) |
| GET | `/api/admin/addresses/:id` | Детали адреса |
| POST | `/api/admin/addresses` | Создать адрес |
| PUT | `/api/admin/addresses/:id` | Обновить адрес |
| DELETE | `/api/admin/addresses/:id` | Удалить адрес |
| GET | `/api/admin/addresses/search?q=...` | Поиск по адресу (для инженера) |
| **Виды оборудования** | | |
| GET | `/api/admin/equipment-types` | Список видов оборудования |
| POST | `/api/admin/equipment-types` | Создать вид |
| PUT | `/api/admin/equipment-types/:id` | Обновить вид |
| DELETE | `/api/admin/equipment-types/:id` | Удалить вид |
| **Типы помещений** | | |
| GET | `/api/admin/room-types` | Список типов помещений |
| POST | `/api/admin/room-types` | Создать тип |
| PUT | `/api/admin/room-types/:id` | Обновить тип |
| DELETE | `/api/admin/room-types/:id` | Удалить тип |
| **Рекомендации** | | |
| GET | `/api/admin/recommendations?equipment_type_id=...` | Список рекомендаций (фильтр по оборудованию) |
| POST | `/api/admin/recommendations` | Создать рекомендацию |
| PUT | `/api/admin/recommendations/:id` | Обновить рекомендацию |
| DELETE | `/api/admin/recommendations/:id` | Удалить рекомендацию |
| **Пользователи** | | |
| GET | `/api/admin/users?search=...` | Список пользователей (поиск по ФИО/email, лимит 50, возврат specializationVik/specializationIszh/specializationGpm/specializationDgu/specializationIbp) |
| POST | `/api/admin/users` | Создать пользователя (принимает specializationVik, specializationIszh, specializationGpm, specializationDgu, specializationIbp; валидация: ≥1 для engineer) |
| PUT | `/api/admin/users/:id` | Обновить пользователя (валидация специализации; сброс при смене роли на не-engineer) |
| DELETE | `/api/admin/users/:id` | Деактивировать пользователя |
| **Аудит** | | |
| GET | `/api/admin/audit-log` | Журнал аудита (пагинация, фильтры) |
| **Метрики** | | |
| GET | `/api/admin/metrics?period=30` | Продуктовые метрики: DAU, WAU, MAU, Retention, по ролям, топ-10 действий (period: 7/30/90 дней) |
| **Привязки ТМ** | | |
| GET | `/api/admin/tm-objects` | Список привязок объектов к ТМ |
| POST | `/api/admin/tm-objects` | Создать привязку объекта к ТМ |
| DELETE | `/api/admin/tm-objects/:id` | Удалить привязку |
| GET | `/api/admin/tm-engineers` | Список привязок инженеров к ТМ |
| POST | `/api/admin/tm-engineers` | Привязать инженера к ТМ |
| DELETE | `/api/admin/tm-engineers/:id` | Удалить привязку |
| **Команды ТМ** | | |
| GET | `/api/admin/tm-team` | Список команд (пары memberTmId → leadTmId с именами) |
| POST | `/api/admin/tm-team` | Создать связь в команде (body: `{ memberTmId, leadTmId }`) |
| DELETE | `/api/admin/tm-team/:id` | Удалить связь из команды |
| **Импорт** | | |
| GET | `/api/admin/import-logs` | История импортов |
| **Предложения оборудования** | | |
| POST | `/api/proposals` | Создать предложение оборудования (+ `newManufacturer`, `newModel`, `pending_until`, `taskId`) | Auth |
| POST | `/api/proposals/room-change` | Предложение переноса оборудования в другое помещение | Auth (engineer) |
| PATCH | `/api/proposals/:id` | Редактирование proposal (инженер — свои pending, админ — любые); при изменении `serialNumber` обновляется `object_equipment` | Auth |
| DELETE | `/api/proposals/:id` | Отмена своего pending-proposal (статус → rejected) | Auth (engineer) |
| GET | `/api/proposals/my?status=pending` | Список своих proposals (инженер) | Auth (engineer) |
| GET | `/api/proposals/admin` | Список предложений (+ фильтры `request_type`, `address_id`, `engineer_id`, `expiring_soon`) | Admin |
| PUT | `/api/proposals/admin/:id/approve` | Утвердить (+ логика для `room_change` и `new_equipment`; синхронизация `brand`/`model`/`serialNumber` из proposal в задачу визита) | Admin |
| PUT | `/api/proposals/admin/:id/reject` | Отклонить (+ поле `reason`, откат `room_change`) | Admin |
| PUT | `/api/proposals/admin/batch` | Массовое одобрение/отклонение (`{ ids, action, reason? }`) | Admin |
| GET | `/api/proposals/:id/meter-photos` | Получение фото прибора учёта (по taskId → objectEquipmentId → fallback) | Admin |
| **Сводные отчёты** | | |
| GET | `/api/reports/summary?period=day\|week\|month&date=...` | Сводный отчёт за период | TM/Admin |
| GET | `/api/reports/by-object?addressId=...&dateFrom=...&dateTo=...` | Отчёт по объекту | TM/Admin |

#### 4.2.1. Массовый импорт (CSV / XLSX)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/admin/import/addresses` | Импорт адресов |
| POST | `/api/admin/import/equipment-types` | Импорт видов оборудования (CSV: name, code, photos_required, is_active, specialization_req) |
| POST | `/api/admin/import/room-types` | Импорт типов помещений |
| POST | `/api/admin/import/recommendations` | Импорт рекомендаций |
| POST | `/api/admin/import/users` | Импорт пользователей (с генерацией паролей) |
| POST | `/api/admin/import/tm-objects` | Импорт привязки объектов к ТМ |
| POST | `/api/admin/import/tm-engineers` | Импорт привязки инженеров к ТМ |
| POST | `/api/admin/import/object-equipment` | Импорт оборудования объектов (room_type опционален) |
| GET | `/api/admin/import-logs` | История импортов |

**Параметры импорта:**
- Поддерживаемые форматы: `.csv` (разделители `,` / `;`, кодировки UTF-8 / Windows-1251) и `.xlsx` (Excel 2007+)
- Для Excel: первый лист, первая строка = заголовки, пустые строки игнорируются
- Поддержка режима предвалидации: `?mode=validate` (проверка без сохранения данных)
- Автоопределение кодировки файла (UTF-8 / Windows-1251) для CSV
- Ограничение: не более 20 000 строк, не более 10 МБ за один импорт
- При импорте пользователей — автоматическая отправка email с учётными данными (логин + временный пароль)
- При импорте object-equipment — поле `room_type` опционально (пустое → `room_type_code = NULL`)
- Поддержка названия типа оборудования (не только кода) — система ищет тип по коду, затем по названию
- `room_type = "Объект"` привязывает оборудование к уровню объекта (`room_type_code = NULL`)
- Оптимизация: справочники (типы оборудования, типы помещений, адреса) предзагружаются в память перед обработкой строк импорта

#### 4.2.2. Оборудование объектов

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/refs/object-equipment?address_id=...&exclude_visit_id=...&specialization=...&binding_level=...&room_type_code=...&confirmation_status=...` | Список оборудования объекта (с фильтрацией, + поле `confirmationStatus`) |
| GET | `/api/refs/object-equipment/rooms?address_id=...&exclude_visit_id=...` | Сводка по помещениям объекта (с фильтрацией по специализации инженера) |
| GET | `/api/refs/object-equipment/other-rooms?address_id=...&current_room_type_code=...` | Оборудование из других помещений объекта (для переноса, с фильтрацией по специализации инженера) |
| PATCH | `/api/refs/object-equipment/:id/room` | Уточнить помещение (body: `roomTypeCode`). 409 если уже указано |
| GET | `/api/admin/object-equipment?address_id=...` | Список оборудования объекта (админ) |
| POST | `/api/admin/object-equipment` | Добавить оборудование к объекту (roomTypeCode опционально) |
| PUT | `/api/admin/object-equipment/:id` | Обновить оборудование |
| DELETE | `/api/admin/object-equipment/:id` | Удалить оборудование |

**Параметры `GET /api/refs/object-equipment`:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `address_id` | UUID | Обязательный. ID адреса объекта |
| `exclude_visit_id` | UUID | Исключить оборудование, уже добавленное в указанный визит |
| `specialization` | `vik` / `iszh` / `gpm` / `dgu` / `ibp` | Фильтрация по специализации (через поле `specialization_req` в `equipment_types`) |
| `binding_level` | `room` / `object` | Фильтрация по уровню привязки: `room` → записи с `roomTypeCode IS NOT NULL`, `object` → записи с `roomTypeCode IS NULL` |
| `room_type_code` | string | Фильтрация по коду типа помещения |

**Ответ `GET /api/refs/object-equipment/rooms`:**

```json
[
  { "code": "server", "name": "Серверная", "count": 3 },
  { "code": "kabinet", "name": "Кабинет", "count": 1 }
]
```

Возвращает массив объектов с кодом типа помещения, названием и количеством единиц оборудования в данном помещении (с учётом фильтрации по `address_id` и `exclude_visit_id`).

### 4.3. Визиты и задачи (Инженер)

| Метод | Путь | Описание |
|-------|------|----------|
| **Визиты** | | |
| POST | `/api/visits` | Создать визит (при создании — автопривязка заявок по `object_code` через `visit_requests`) |
| GET | `/api/visits` | Список визитов с пагинацией (параметры: `page`, `pageSize`; ответ включает `globalStats` — сводная статистика по всем визитам, включая объединённый список номеров заявок из `importedRequests` и `visitRequests → importedRequest`) |
| GET | `/api/visits/:id` | Детали визита (со всеми задачами + объединённый список заявок `requests[]` из `importedRequests` и `visitRequests`) |
| PUT | `/api/visits/:id` | Обновить визит (адрес, дата, ФИО) |
| DELETE | `/api/visits/:id` | Удалить визит (любой статус, каскадно) |
| POST | `/api/visits/:id/complete` | Завершить визит |
| GET | `/api/visits/:id/report/download` | Повторное скачивание отчёта |
| **Задачи** | | |
| POST | `/api/visits/:visitId/tasks` | Добавить задачу (body: `equipmentTypeId`, `roomTypeId?`, `objectEquipmentId?`, `comment?`, `brand?`, `model?`, `serialNumber?`). **Автопривязка:** если `objectEquipmentId` не передан, сервер автоматически находит свободную единицу оборудования на адресе визита по типу оборудования |
| GET | `/api/visits/:visitId/tasks` | Список задач визита |
| GET | `/api/visits/:visitId/tasks/:id` | Детали задачи |
| PUT | `/api/visits/:visitId/tasks/:id` | Обновить задачу (параметры, заключение) |
| DELETE | `/api/visits/:visitId/tasks/:id` | Удалить задачу |
| POST | `/api/visits/:visitId/tasks/:id/reset` | Сбросить задачу |
| **Фото** | | |
| POST | `/api/tasks/:taskId/photos` | Загрузить фото (multipart/form-data) |
| GET | `/api/tasks/:taskId/photos` | Список фото задачи |
| DELETE | `/api/tasks/:taskId/photos/:photoId` | Удалить фото |
| GET | `/api/photos/:id/file` | Получить файл фото |
| POST | `/api/photos/check-duplicate` | Проверка дубликата фото по SHA-256 хешу (возвращает информацию о существующем фото) |
| GET | `/api/photos/:id/duplicates` | Все pHash-дубликаты фото (список с метаданными: объект, оборудование, инженер, дата, сходство) |
| **Групповые задачи (климат)** | | |
| POST | `/api/tasks/items/:itemId/photos` | Загрузить фото для единицы в групповой задаче (multipart/form-data) |
| GET | `/api/visits/:visitId/tasks/:id/items` | Список единиц оборудования в групповой задаче |
| PUT | `/api/tasks/items/:itemId` | Обновить статус единицы в групповой задаче |
| DELETE | `/api/tasks/items/:itemId` | Удалить единицу из групповой задачи |

**GET `/api/visits`** — параметры и формат ответа:
- Query-параметры: `page` (номер страницы, по умолчанию 1), `pageSize` (записей на странице, по умолчанию 20), `status` (одиночный статус), `statuses` (мульти-фильтр, comma-separated), `search` (поиск по адресу или коду объекта, case-insensitive), `date_from`, `date_to`, `user_id`, `include_deleted` (только admin)
- Ответ: `{ data: Visit[], total: number, page: number, pageSize: number, globalStats: { total, planned, inProgress, completed } }`
- `globalStats` — сводная статистика по **всем** визитам (без учёта пагинации и без учёта фильтра по статусам), рассчитывается через `groupBy` по статусам
- **Объединение заявок:** каждый визит в ответе содержит поле `requests[]` — объединённый массив номеров заявок из двух источников:
  1. `importedRequests` — заявки, привязанные напрямую через `imported_requests.visit_id` (устаревшая привязка один-ко-многим)
  2. `visitRequests → importedRequest` — заявки, привязанные через связующую таблицу `visit_requests` (актуальная связь многие-ко-многим)
  
  Дедупликация по `imported_request_id`. В UI отображаются первые 2 номера заявок + счётчик «+N» (если их больше)

**POST `/api/visits`** — автопривязка заявок (все роли):
- При создании визита указывается `addressId` (адрес объекта) — работает для всех ролей (инженер, ТМ, администратор)
- Сервер автоматически находит заявки типа «ИСЖ объекта» из `imported_requests` с совпадающим `object_code` (через `addresses.object_code`)
- Фильтр по периоду действия заявки: `startDate <= visitDate <= deadline`
- Для каждой найденной заявки создаётся запись в `visit_requests`, связывающая новый визит с заявкой
- Если заявка имеет `equipment_type_code` вида «ИСЖ объекта» — визит помечается `is_multi_specialist = TRUE`
- Автопривязка не создаёт дубликатов (UNIQUE constraint на `visit_id + imported_request_id`)
- Дополнительная автопривязка заявок на конкретное оборудование выполняется при завершении визита (`POST /:id/complete`) и при создании задачи (`POST /:visitId/tasks`)
- **Расширенная проверка дубликатов визитов:** при создании визита инженером поиск существующего визита на тот же адрес проверяет не только `userId` визита, но и записи в `visitEngineers`. Это предотвращает создание дубликатов, когда ТМ назначил инженера через `visitEngineers`, а инженер затем создаёт визит самостоятельно

### 4.3.1. Офлайн-методы (клиент)

| Метод | Описание |
|-------|----------|
| api.createVisitOffline(data) | Создание визита (онлайн → сервер, офлайн → IndexedDB + syncQueue) |
| api.createTaskOffline(visitId, data) | Создание задачи с офлайн-поддержкой |
| api.updateTaskOffline(visitId, taskId, data) | Обновление параметров задачи |
| api.uploadPhotoOffline(taskId, file, moment) | Загрузка фото (офлайн → Blob в IndexedDB) |
| api.completeVisitOffline(visitId) | Завершение визита |
| api.deleteVisitOffline(visitId) | Удаление визита (soft delete) |
| api.getLocalVisits() | Получить визиты из IndexedDB |
| api.getLocalTasks(visitLocalId) | Получить задачи из IndexedDB |
| api.getLocalPhotos(taskLocalId) | Получить фото из IndexedDB |
| api.getLocalPhotoUrl(photoLocalId) | Получить Blob URL фото из IndexedDB |

### 4.3.2. Визиты и задачи (ТМ)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/visits` | Список визитов своих инженеров (автофильтрация по роли tm) |
| GET | `/api/visits/:id` | Детали визита (если визит инженера из группы ТМ) |
| PUT | `/api/visits/:id` | Редактирование визита инженера |
| DELETE | `/api/visits/:id` | Soft delete визита |
| POST | `/api/visits/:id/reassign` | Переназначение визита другому инженеру |
| POST | `/api/visits` | Создание визита с назначением на инженера |
| POST | `/api/reports/:id/report/send` | Отправка отчёта (статус sent_by_tm) |

**POST `/api/visits/:id/reassign`**
Request: `{ "newUserId": "uuid" }`
Response: Visit object (updated)
Ограничение: только для ролей tm и admin. Инженер должен быть из группы ТМ.

### 4.4. Отчёты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/visits/:id/report/generate` | Сформировать PDF + Excel + ZIP |
| GET | `/api/visits/:id/report/download` | Скачать ZIP-архив (PDF + фото + Excel) |
| POST | `/api/visits/:id/report/send` | Отправить отчёт по email |
| POST | `/api/reports/summary-generate` | **Унифицированный сводный отчёт** (period/objects/requests) с превью фото и сканами актов | TM/Admin |
| POST | `/api/reports/upload-act-scans` | **Загрузка сканов актов** (multipart, до 10 файлов, 50 МБ) | TM/Admin |

**POST /api/reports/summary-generate** — тело запроса:
```json
{
  "type": "period" | "objects" | "requests",
  "dateFrom": "YYYY-MM-DD",
  "dateTo": "YYYY-MM-DD",
  "addressIds": ["uuid", ...],     // обязательно для type=objects
  "engineerId": "uuid",            // опционально
  "requestIds": ["uuid", ...],     // обязательно для type=requests (ID записей imported_requests)
  "contractId": "uuid",            // опционально, для режима «По договору и периоду» — сервер находит все заявки договора за период
  "scanIds": ["uuid", ...]         // опционально, из upload-act-scans
}
```
Ответ: PDF-файл (application/pdf) или ошибка.

**Логика `contractId`:** при передаче `contractId` сервер находит все заявки (`imported_requests`) данного договора за период `dateFrom`–`dateTo`, затем через `visit_requests` определяет все связанные визиты и формирует сводный отчёт. Виртуальные визиты (без `userId`) исключаются из отчёта.

**Логика отчётов для заявок «ИСЖ объекта» (type=requests):**
- Заявка «ИСЖ объекта» подразумевает ТО **всего** оборудования объекта, а не отдельного вида оборудования
- При формировании отчёта по таким заявкам система находит **все** визиты, связанные с заявкой через `visit_requests` (многие-ко-многим), а также через `imported_requests.visit_id` (прямая привязка)
- Отчёт агрегирует данные из **всех** связанных визитов: задачи, фото, рекомендации — независимо от того, какой инженер их создал
- Таким образом, полный отчёт по заявке ИСЖ объекта содержит результаты работы нескольких инженеров с разными специализациями (ВиК, ИСЖ, ГПМ и др.), каждый из которых выполнил ТО своей части оборудования

**POST /api/reports/upload-act-scans** — multipart/form-data, поле `files[]`.
Ответ: `{ scanIds: string[] }`.

### 4.5. Справочники (чтение для Инженера)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/refs/equipment-types` | Активные виды оборудования |
| GET | `/api/refs/room-types` | Активные типы помещений |
| GET | `/api/refs/recommendations?equipment_type_id=...` | Рекомендации по виду оборудования |
| GET | `/api/refs/addresses/search?q=...` | Поиск адресов (автодополнение) |

### 4.6. Синхронизация (офлайн → онлайн)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/sync/visits` | Пакетная синхронизация визитов из IndexedDB |
| POST | `/api/sync/photos` | Загрузка накопленных фото |

### 4.7. Личный кабинет и специализация

| Метод | Путь | Описание | Авторизация |
|-------|------|----------|:-----------:|
| GET | `/api/profile` | Профиль пользователя (ФИО, роль, специализации) | Auth |
| GET | `/api/profile/stats` | Статистика: визиты за месяц, кол-во замечаний | Auth |
| PATCH | `/api/profile/specialization` | Обновить специализации (`{ specializationVik: bool, specializationIszh: bool, specializationGpm: bool, specializationDgu: bool, specializationIbp: bool }`) | Auth |
| GET | `/api/profile/favorites` | Список избранных объектов (инженер) | Auth |
| POST | `/api/profile/favorites` | Добавить в избранное (`{ addressId: uuid }` или `{ objectCode: string }`) | Auth |
| DELETE | `/api/profile/favorites/*` | Удалить из избранного (wildcard для object_code со слешами) | Auth |
| GET | `/api/profile/objects` | Закреплённые объекты ТМ (с индикатором неисправностей) | Auth (TM) |
| POST | `/api/profile/engineers` | Создать инженера с привязкой к ТМ (`{ fullName, email, specializationVik?, specializationIszh?, specializationGpm?, specializationDgu?, specializationIbp? }`) | Auth (TM) |

**GET `/api/profile/stats`**
```json
// Response 200
{ "visitsThisMonth": 12, "issuesFound": 3 }
```

**POST `/api/profile/favorites`**
```json
// Request (оба варианта поддерживаются)
{ "addressId": "uuid" }   // сервер резолвит object_code из addresses
{ "objectCode": "RU/77/001" }

// Response 201
{ "id": "uuid", "user_id": "uuid", "object_code": "RU/77/001", "added_at": "..." }
```

**GET `/api/profile/objects`** (для ТМ)
```json
// Response 200
[
  { "id": "uuid", "objectCode": "RU/77/001", "fullAddress": "...", "hasFaultyVisit": true }
]
```

**POST `/api/profile/engineers`** (для ТМ)
```json
// Request
{ "fullName": "Петров А.И.", "email": "petrov@example.com", "specializationVik": false, "specializationIszh": true, "specializationGpm": false, "specializationDgu": false, "specializationIbp": false }

// Response 201
{ "id": "uuid", "fullName": "Петров А.И.", "email": "petrov@example.com", "role": "engineer" }
// На email инженера отправляется временный пароль Welcome2026!
```

**Ограничения:**
- Максимум 20 избранных объектов на пользователя
- Дубликаты запрещены (UNIQUE constraint)
- Инженер может изменять только свою специализацию; ТМ/Админ — специализацию подчинённых инженеров

### 4.8. Маппинг специализаций

| Специализация | Поле | Коды оборудования |
|:-------------:|------|-------------------|
| ВиК | `specialization_vik` | vent (деактивирован), vrv_vn, vrv_nar, mssvn, mssnar, splitvn, splitnar, teplozavesa, pritochnaya, pritochno-vytyzhnaya, vytyzhnaya, cond_mobile |
| ИСЖ | `specialization_iszh` | rsch, schetchik_gvs, schetchik_hvs, schetchik_electroshc, seti_vodosnab, teplovye_seti, itp, boiler_gas, boiler_liquid, boiler_solid, boiler_elec, meter_gas, sololift, barrier_roller, door_auto, coffee, purifier, cooler, aquarium, bubble_panel |
| ГПМ | `specialization_gpm` | lift_pass, lift_cargo, lift_cargo_pass, lift_invalid |
| ДГУ | `specialization_dgu` | dgu, mkgu |
| ИБП | `specialization_ibp` | ibp |

### 4.9. Уведомления

| Метод | Путь | Описание | Авторизация |
|-------|------|----------|:-----------:|
| GET | `/api/notifications?limit=&offset=&unread_only=` | Список уведомлений (пагинация, новые — в начале) | Auth |
| PATCH | `/api/notifications/:id/read` | Отметить одно как прочитанное | Auth |
| PATCH | `/api/notifications/read-all` | Прочитать все | Auth |
| POST | `/api/notifications/clear-all` | Очистить все уведомления (мягкое удаление: `is_deleted = true`) | Auth |

**GET `/api/notifications`** — ответ:
```json
{
  "data": [{ "id": "uuid", "type": "proposal_created", "title": "...", "message": "...", "entityType": "equipment_proposal", "entityId": "uuid", "isRead": false, "createdAt": "..." }],
  "unreadCount": 5
}
```

Все существующие эндпоинты уведомлений фильтруют `is_deleted = false` — удалённые уведомления не возвращаются.

**Deep links (переходы по клику на уведомление):**

| Тип уведомления | Целевой маршрут |
|-----------------|-----------------|
| `proposal_created` / `proposal_approved` / `proposal_rejected` / `proposal_expiring_soon` / `proposal_expired` | `/admin/proposals` |
| `equipment_removed` | `/admin/object-equipment` |
| `request_assigned` / `request_unassigned` | `/my-requests` (инженер) |
| `request_declined` / `request_imported` | `/requests` (ТМ) |
| `system_release` | `/profile` (раздел «Системная информация») |

### 4.10. Системные эндпоинты

| Метод | Путь | Описание | Авторизация |
|-------|------|----------|:-----------:|
| POST | `/api/system/webhook/deploy` | Webhook от CI/CD: создание уведомлений о релизе | HMAC-подпись |
| POST | `/api/admin/system-notifications` | Ручное создание системного уведомления (админ) | Auth (admin) |
| POST | `/api/internal/cron/process-expired-proposals` | Cron-обработка истёкших proposals (ежедневно 03:00) | `CRON_SECRET` |

**POST `/api/system/webhook/deploy`** — webhook для автоматического оповещения о деплое:
- Заголовки: `X-Webhook-Signature: sha256=<HMAC>`, `X-Webhook-Timestamp: <unix_timestamp>`
- Тело: `{ "version": "v2.4.0", "release_notes": "..." }`
- Логика: проверка HMAC-подписи (`WEBHOOK_SECRET`), проверка timestamp (±5 мин), защита от дубликатов по `system_releases.version`, массовое создание уведомлений `system_release` для всех активных пользователей
- Rate limit: 10 запросов / 15 минут

**POST `/api/admin/system-notifications`** — ручное создание:
- Тело: `{ "title": "...", "message": "...", "version": "v2.5.0" }`
- Запись в `system_releases` (`deployed_by: 'admin_manual'`), массовое создание уведомлений

**POST `/api/internal/cron/process-expired-proposals`** — ежедневная обработка:
1. Пометить истёкшие proposals: `status = 'expired'`
2. Откатить `object_equipment` для `room_change` (восстановить `old_room_type_code`)
3. Деактивировать `object_equipment` для `new_equipment` (`is_active = false`)
4. Создать уведомления `proposal_expired` и `proposal_expiring_soon` (за 3 дня до истечения)
5. Защита от повторной обработки через `reviewed_at >= NOW() - 1 hour`

---

## См. также

- [Модель данных](data-model.md) — описание таблиц БД
- [Структура параметров JSONB](params-jsonb.md) — форматы JSONB-полей
- [Бизнес-логика](business-logic.md) — валидация и workflow
- [ТЗ: Модуль «Инженер»](../tz/module-engineer.md)

---

## 5. СТРУКТУРА ПАРАМЕТРОВ (JSONB)

Поле `tasks.parameters` хранит данные в формате JSON. Структура зависит от типа оборудования: