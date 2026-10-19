# Нефункциональные требования и структура данных

## Содержание
- [8. НЕФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ](#8-нефункциональные-требования)
  - [8.1. Архитектура](#81-архитектура)
  - [8.2. Производительность](#82-производительность)
  - [8.2.1. Офлайн-режим](#821-офлайн-режим)
  - [8.3. Безопасность](#83-безопасность)
  - [8.4. Масштабируемость](#84-масштабируемость)
  - [8.5. Совместимость](#85-совместимость)
- [9. СТРУКТУРА ДАННЫХ](#9-структура-данных)
  - [9.1. ER-диаграмма (основные сущности)](#91-er-диаграмма-основные-сущности)
  - [9.2. Основные таблицы](#92-основные-таблицы)
  - [9.3. Таблицы локального хранилища (IndexedDB / Dexie)](#93-таблицы-локального-хранилища-indexeddb--dexie)

> Данный файл содержит разделы 8–9 из исходного «Техническое задание.md»

## 8. НЕФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ

### 8.1. Архитектура
- **Тип приложения:** PWA (Progressive Web App)
- **Frontend:** React / Vue.js + Service Workers + IndexedDB
- **Backend:** Node.js / Python (FastAPI)
- **База данных:** PostgreSQL
- **Генерация PDF:** jsPDF / Puppeteer / WeasyPrint
- **Генерация ZIP:** JSZip (на клиенте) или архивация на сервере; Excel-таблица формируется через `exceljs`
- **Email:** SMTP / SendGrid / Mailgun

### 8.2. Производительность
- Время загрузки страницы: не более 3 секунд (при 4G)
- Время формирования PDF: не более 10 секунд (для 20 задач)
- Время формирования ZIP: не более 15 секунд (для 40 фото)
- Офлайн-работа: полная функциональность без интернета

### 8.2.1. Офлайн-режим

**Требования к офлайн-работе:**
- Приложение должно функционировать без подключения к интернету
- Все действия инженера (создание визита, заполнение параметров, фотофиксация) сохраняются локально (IndexedDB)
- При восстановлении соединения — автоматическая синхронизация с сервером
- Фотографии хранятся как Blob в IndexedDB до момента синхронизации
- Очередь мутаций с повторными попытками (до 5 раз)
- Визуальный индикатор статуса: «Офлайн» / «Синхронизация...» / «Онлайн»
- Service Worker кэширует API-ответы (NetworkFirst, timeout 3с, TTL 7 дней)

**Технологии:**
- Dexie.js (IndexedDB wrapper)
- Workbox (Service Worker)
- navigator.onLine API

### 8.3. Безопасность
- Аутентификация: JWT-токены
- Авторизация: ролевая модель (п. 3.2)
- Шифрование данных: TLS 1.3
- Хранение паролей: bcrypt
- Защита от XSS, CSRF, SQL-инъекций
- Соответствие 152-ФЗ (персональные данные)

### 8.4. Масштабируемость
- Поддержка до 500 одновременных пользователей
- Хранение данных: не менее 5 лет
- Резервное копирование: ежедневно

### 8.5. Совместимость
- Браузеры: Chrome 90+, Safari 14+, Firefox 88+, Edge 90+
- Устройства: смартфоны (iOS 14+, Android 10+), планшеты
- Разрешение экрана: от 320×568 до 1920×1080

---

## 9. СТРУКТУРА ДАННЫХ

### 9.1. ER-диаграмма (основные сущности)

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Users     │       │   Addresses  │       │   Visits     │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ full_name    │       │ city         │◄──────│ address_id   │
│ email        │       │ street       │       │ user_id      │
│ role         │       │ house        │       │ date_start   │
│ password     │       │ building     │       │ time_start   │
│ is_active    │       │ full_address │       │ time_end     │
└──────────────┘       │ object_code  │       │ season       │
                       │ customer_email│      │ status       │
                       └──────────────┘
                                              └──────┬───────┘
                                                     │
                                                     │ 1:N
                                                     ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Equipment   │       │    Tasks     │       │    Photos    │
│    Types     │       ├──────────────┤       ├──────────────┤
├──────────────┤       │ id (PK)      │       │ id (PK)      │
│ id (PK)      │◄──────│ visit_id (FK)│◄──────│ task_id (FK) │
│ name         │       │ equipment_   │       │ file_path    │
│ code         │       │  type_id(FK) │       │ moment       │
│ photos_req.  │       │ room_type_id │       │ created_at   │
│ specialization│      │ object_equip.│       └──────────────┘
└──────────────┘       │   _id (FK?)  │
                       │ comment      │       ┌──────────────┐
                       │ brand        │       │  Room Types  │
                       │ model        │       ├──────────────┤
                       │ serial_number│       │ id (PK)      │
                       │ parameters   │       │ name         │
                       │ recommendat. │       │ code         │
                       │ conclusion   │       └──────────────┘
                       └──────────────┘
┌──────────────┐       ┌──────────────────┐
│Recommendations│       │ object_equipment │
├──────────────┤       ├──────────────────┤
│ id (PK)      │       │ id (PK)          │
│ equipment_   │       │ address_id (FK)  │
│  type_id(FK) │       │ equipment_type_  │
│ text         │       │  code            │
│ sort_order   │       │ room_type_code   │
└──────────────┘       │ brand            │
                       │ model            │
                       │ serial_number    │
                       │ location_descr.  │
                       │ is_active        │
                       │ confirmation_    │
                       │  status          │
                       │ pending_until    │
                       └──────────────────┘
┌──────────────────┐   ┌──────────────────┐
│  notifications   │   │ system_releases  │
├──────────────────┤   ├──────────────────┤
│ id (PK)          │   │ id (PK)          │
│ user_id (FK)     │   │ version (UNIQUE) │
│ type             │   │ release_notes    │
│ title            │   │ deployed_at      │
│ message          │   │ deployed_by      │
│ entity_type      │   │ notification_cnt │
│ entity_id        │   └──────────────────┘
│ is_read          │
│ is_deleted       │
│ created_at       │
└──────────────────┘
```

### 9.2. Основные таблицы

**Users** — пользователи системы. Поле `role` имеет значения: `engineer`, `tm`, `admin`.
**Addresses** — справочник адресов
**RoomTypes** — типы помещений
**EquipmentTypes** — виды оборудования
**Recommendations** — типовые рекомендации
**Visits** — визиты инженера. Дополнительные поля: `assigned_by_id` (UUID — кем назначен), `assigned_at` (TIMESTAMP — дата назначения), `sent_by_engineer_at` (TIMESTAMP — дата отправки инженером), `sent_by_tm_at` (TIMESTAMP — дата отправки ТМ), `tm_corrected` (BOOLEAN — откорректирован ТМ), `is_deleted` (BOOLEAN — удалён ли визит), `deleted_by_id` (UUID — кем удалён), `deleted_at` (TIMESTAMP — дата удаления).

Поле `status` (VisitStatus) принимает следующие значения:
- `planned` — Запланировано (ТМ назначил визит инженеру)
- `not_started` — Не начато
- `in_progress` — В работе
- `completed` — Выполнено
- `sent` — Отправлен (общий статус)
- `sent_by_engineer` — Отправлен инженером
- `sent_by_tm` — Отправлен ТМ
- `corrected_by_tm` — Откорректирован ТМ

**Tasks** — задачи в чек-листе. Поля: `task_type` (VARCHAR, default 'individual' — тип задачи: 'individual' или 'group_climate'), `object_equipment_id` (UUID, nullable — ссылка на `object_equipment`, если задача создана из привязки объекта), `room_type_code` (VARCHAR, nullable — код помещения для групповых задач), `comment` (текстовый комментарий, бывшее `location`), `brand` (марка оборудования), `model` (модель оборудования), `serial_number` (серийный номер). Для групповых задач (`task_type = 'group_climate'`) общие параметры хранятся в `parameters`, а единицы оборудования — в связанной таблице `task_equipment_items`.
**Photos** — привязка фото к задачам. Для индивидуальных задач — через `task_id`. Для групповых задач — через `task_equipment_item_id` (каждое фото привязано к конкретной единице в групповой задаче).

**Таблица task_equipment_items** — единицы оборудования в групповой задаче:

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| task_id | UUID | FK на tasks (групповая задача) |
| object_equipment_id | UUID | FK на object_equipment (конкретная единица) |
| status | VARCHAR | Статус единицы: 'ok' / 'not_ok' (nullable) |
| sort_order | INT | Порядок отображения |
| created_at | TIMESTAMP | Дата создания |

Уникальный: `(task_id, object_equipment_id)`.

**Таблица tm_objects** — привязка объектов к ТМ:

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| tm_id | UUID | Ссылка на ТМ |
| address_id | UUID | Ссылка на адрес объекта |
| created_at | TIMESTAMP | Дата создания |

**Таблица tm_engineers** — привязка инженеров к ТМ:

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| tm_id | UUID | Ссылка на ТМ |
| engineer_id | UUID | Ссылка на инженера |
| created_at | TIMESTAMP | Дата создания |

**Таблица tm_team_members** — команды территориальных менеджеров (группировка нескольких ТМ):

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| member_tm_id | UUID | Ссылка на ТМ-участника команды |
| lead_tm_id | UUID | Ссылка на ТМ-лидера команды |
| created_at | TIMESTAMP | Дата создания |

Лидер команды видит визиты, заявки, отчёты и аналитику всех инженеров, закреплённых за любым участником команды. Участник (ТМ2) видит инженеров лидера (обратная связь). Уникальный ключ: (member_tm_id, lead_tm_id).

**Таблица object_equipment** — привязка оборудования к объектам (адресам). Структура описана в разделе 6.6. Используется для автозаполнения чек-листа при создании визита.

**Таблица equipment_proposals** — предложения инженеров по добавлению оборудования в привязку объекта. Структура описана в разделе 6.7. Статусы: `pending`, `approved`, `rejected`, `expired`. Расширенные поля: `request_type` (new_equipment / room_change / brand_change), `old_room_type_code`, `rejection_reason`, `pending_until` (TTL), `object_equipment_id`.

**Таблица notifications** — внутренние уведомления пользователей. Структура описана в разделе 6.15.2. Поля: `user_id`, `type`, `title`, `message`, `entity_type`, `entity_id`, `is_read`, `is_deleted`, `created_at`.

**Таблица system_releases** — история деплоев для предотвращения дубликатов уведомлений о релизах. Поля: `id` (UUID), `version` (VARCHAR(50), UNIQUE), `release_notes` (TEXT), `deployed_at` (TIMESTAMP), `deployed_by` (VARCHAR(50): `ci_webhook` / `admin_manual`), `admin_id` (UUID, nullable), `notification_count` (INT).

### 9.3. Таблицы локального хранилища (IndexedDB / Dexie)

| Таблица | Назначение |
|---------|-----------|
| visits | Локальные визиты (с флагом dirty для синхронизации) |
| tasks | Локальные задачи (привязаны к visitLocalId) |
| photos | Фото как Blob (до синхронизации с сервером) |
| syncQueue | Очередь операций для отправки на сервер |
| cachedRefs | Кэш справочников (адреса, оборудование, помещения) |

---

## См. также

- [_overview.md](_overview.md) — Общие сведения, ролевая модель, критерии приёмки
- [references.md](references.md) — Справочники и структура данных
- [module-engineer.md](module-engineer.md) — Модуль «Инженер»: офлайн-режим и синхронизация
- [mobile-app.md](mobile-app.md) — Мобильное приложение: SQLite, офлайн, push-уведомления
