# Модель данных

## Содержание

- [3. Модель данных](#3-модель-данных)
  - [3.1. ER-диаграмма](#31-er-диаграмма)
  - [3.2. Детальное описание таблиц](#32-детальное-описание-таблиц)
    - [3.2.1. users — Пользователи системы](#321-users--пользователи-системы)
    - [3.2.1.1. tm_objects](#3211-tm_objects--привязка-объектов-к-тм)
    - [3.2.1.2. tm_engineers](#3212-tm_engineers--привязка-инженеров-к-тм)
    - [3.2.1.3. tm_team_members — Команды ТМ](#3213-tm_team_members--команды-тм)
    - [3.2.1.4. import_logs — История импортов](#3214-import_logs--история-импортов)
    - [3.2.2. addresses — Справочник адресов](#322-addresses--справочник-адресов)
    - [3.2.3. equipment_types — Виды оборудования](#323-equipment_types--виды-оборудования)
    - [3.2.4. room_types — Типы помещений](#324-room_types--типы-помещений)
    - [3.2.5. recommendations — Рекомендации](#325-recommendations--типовые-рекомендации)
    - [3.2.6. visits — Визиты](#326-visits--визиты)
    - [3.2.7. tasks — Задачи чек-листа](#327-tasks--задачи-чек-листа)
    - [3.2.7.1. task_equipment_items](#3271-task_equipment_items--единицы-оборудования-в-групповой-задаче)
    - [3.2.8. photos — Фотографии](#328-photos--фотографии)
    - [3.2.9. audit_log — Журнал аудита](#329-audit_log--журнал-аудита)
    - [3.2.10. password_reset_tokens](#3210-password_reset_tokens--токены-сброса-пароля)
    - [3.2.11. object_equipment — Оборудование объектов](#3211-object_equipment--оборудование-объектов)
    - [3.2.12. equipment_proposals — Предложения оборудования](#3212-equipment_proposals--предложения-оборудования)
    - [3.2.13. notifications — Уведомления пользователей](#3213-notifications--уведомления-пользователей)
    - [3.2.13.1. system_releases — История релизов](#32131-system_releases--история-релизов)
    - [3.2.14. user_favorite_objects](#3214-user_favorite_objects--избранные-объекты-пользователей)
    - [3.2.15. report_attachments](#3215-report_attachments--вложения-сводных-отчётов)
    - [3.2.16. report_tasks](#3216-report_tasks--задачи-генерации-сводных-отчётов)
    - [3.2.17. imported_requests — Импортированные заявки](#3217-imported_requests--импортированные-заявки)
    - [3.2.18. visit_requests — Связь визитов с заявками](#3218-visit_requests--связь-визитов-с-заявками-многие-ко-многим)
    - [3.2.19. visit_engineers — Привязка инженеров к визиту](#3219-visit_engineers--привязка-инженеров-к-визиту-заявки)
    - [3.2.20. request_assignment_log — История действий с заявками](#3220-request_assignment_log--история-действий-с-заявками)

## 3. МОДЕЛЬ ДАННЫХ

### 3.1. ER-диаграмма

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│    Users     │       │   Addresses  │       │      Visits      │
├──────────────┤       ├──────────────┤       ├──────────────────┤
│ id (UUID PK) │       │ id (UUID PK) │       │ id (UUID PK)     │
│ full_name    │       │ city         │◄──────│ address_id (FK)  │
│ email        │       │ street       │       │ user_id (FK)     │
│ role         │       │ house        │       │ date_start       │
│ password_hash│       │ building     │       │ time_start       │
│ is_active    │       │ full_address │       │ time_end         │
│ created_at   │       │ customer_email│      │ season           │
│ updated_at   │       │ created_at   │       │ status           │
└──────────────┘       │ updated_at   │       │ created_at       │
                       └──────────────┘       │ updated_at       │
                                              └──────┬───────────┘
                                                     │ 1:N
                                                     ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│ Equipment    │       │    Tasks     │       │     Photos       │
│   Types      │       ├──────────────┤       ├──────────────────┤
├──────────────┤       │ id (UUID PK) │       │ id (UUID PK)     │
│ id (UUID PK) │◄──────│ visit_id(FK) │◄──────│ task_id (FK)     │
│ name         │       │ equipment_id │       │ file_name        │
│ code         │       │ room_type_id │       │ file_path        │
│ photos_req.  │       │ object_equip │       │ moment (before/  │
│ is_active    │       │   _id (FK?)  │       │        after)    │
└──────┬───────┘       │ status       │       │ created_at       │
       │               │ parameters   │       └──────────────────┘
       │ 1:N           │  (JSONB)     │
       ▼               │ conclusion   │       ┌──────────────────┐
┌──────────────┐       │ recommendat. │       │   Room Types     │
│Recommendations│      │  (JSONB)     │       ├──────────────────┤
├──────────────┤       │ created_at   │       ├──────────────────┤
│ id (UUID PK) │       │ updated_at   │       │ id (UUID PK)     │
│ equipment_id │       └──────────────┘       │ name             │
│   (FK)       │                              │ code             │
│ text         │                              └──────────────────┘
│ sort_order   │
│ is_active    │
└──────────────┘
```

### 3.2. Детальное описание таблиц

#### 3.2.1. users — Пользователи системы

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ, генерируется автоматически |
| full_name | VARCHAR(200) | ❌ | ФИО пользователя |
| email | VARCHAR(200) | ❌ | Уникальный email, используется для входа |
| password_hash | VARCHAR(255) | ❌ | Хэш пароля (bcrypt, 12 раундов) |
| role | ENUM('engineer', 'tm', 'admin') | ❌ | Роль пользователя |
| must_change_password | BOOLEAN | ❌ | Обязан ли сменить пароль при следующем входе (default: false) |
| specialization_vik | BOOLEAN | ❌ | Специализация «ВиК» — вентиляция и кондиционирование (default: false) |
| specialization_iszh | BOOLEAN | ❌ | Специализация «ИСЖ» — инженерные сети и здания (default: true) |
| specialization_gpm | BOOLEAN | ❌ | Специализация «ГПМ» — подъёмное оборудование (default: false) |
| specialization_dgu | BOOLEAN | ❌ | Специализация «ДГУ» — дизельные генераторные установки (default: false) |
| specialization_ibp | BOOLEAN | ❌ | Специализация «ИБП» — источники бесперебойного питания (default: false) |
| is_active | BOOLEAN | ❌ | Активна ли учётная запись (default: true) |
| created_at | TIMESTAMP | ❌ | Дата создания (default: NOW()) |
| updated_at | TIMESTAMP | ❌ | Дата обновления (auto-update) |

**Индексы:**
- UNIQUE(email)
- INDEX(role)

#### 3.2.1.1. tm_objects — Привязка объектов к ТМ

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| tm_id | UUID FK → users | Ссылка на ТМ |
| address_id | UUID FK → addresses | Ссылка на адрес |
| created_at | TIMESTAMP | Дата создания |

**Уникальный:** (tm_id, address_id)

#### 3.2.1.2. tm_engineers — Привязка инженеров к ТМ

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| tm_id | UUID FK → users | Ссылка на ТМ |
| engineer_id | UUID FK → users | Ссылка на инженера |
| created_at | TIMESTAMP | Дата создания |

**Уникальный:** (engineer_id)

#### 3.2.1.3. tm_team_members — Команды ТМ

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| member_tm_id | UUID FK → users | Ссылка на ТМ-участника команды |
| lead_tm_id | UUID FK → users | Ссылка на ТМ-лидера команды |
| created_at | TIMESTAMP | Дата создания |

**Уникальный:** (member_tm_id, lead_tm_id)

**Бизнес-логика (утилита `getTeamEngineerIds`):**
- Для ТМ-лидера: возвращает IDs всех инженеров, закреплённых за любым участником команды (свои инженеры + инженеры ТМ-участников)
- Для ТМ-участника: возвращает IDs инженеров лидера (обратная связь)
- Используется в фильтрации визитов, заявок, отчётов и аналитики

#### 3.2.1.4. import_logs — История импортов

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| user_id | UUID | Кто запустил |
| entity_type | TEXT | Тип справочника |
| file_name | TEXT | Имя файла |
| total_rows | INT | Всего строк |
| success_rows | INT | Успешно |
| duplicate_rows | INT | Дубликаты |
| error_rows | INT | Ошибки |
| errors | JSONB | Детали ошибок |
| status | TEXT | Статус |
| created_at | TIMESTAMP | Дата |

#### 3.2.2. addresses — Справочник адресов

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| city | VARCHAR(100) | ❌ | Город |
| street | VARCHAR(200) | ❌ | Улица |
| house | VARCHAR(50) | ❌ | Дом |
| building | VARCHAR(50) | ✅ | Строение/корпус |
| full_address | VARCHAR(500) | ❌ | Полный адрес для отображения |
| customer_email | VARCHAR(200) | ✅ | Email заказчика для данного адреса |
| object_code | VARCHAR(50) | ✅ | Аналитический код объекта (уникальный, формат RU/77/001) |
| is_deleted | BOOLEAN | ❌ | Soft delete (default: false) |
| created_at | TIMESTAMP | ❌ | Дата создания |
| updated_at | TIMESTAMP | ❌ | Дата обновления |

**Индексы:**
- INDEX(city, street) — для поиска/автодополнения
- FULLTEXT(full_address) — для полнотекстового поиска
- UNIQUE(object_code)

**Начальное наполнение:** ~230 записей (см. файл `Требования к справочнику.md`).

#### 3.2.3. equipment_types — Виды оборудования

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| name | VARCHAR(100) | ❌ | Наименование |
| code | VARCHAR(50) | ❌ | Код для маркировки фото (транслит) |
| photos_required | INT | ❌ | Количество фото (1 или 2) |
| is_active | BOOLEAN | ❌ | Активен ли вид (default: true) |
| specialization_req | TEXT | ✅ | Требуемая специализация: «vik», «iszh», «gpm», «dgu» или «ibp» (nullable) |

**Управление через UI:** администратор назначает и изменяет `specialization_req` в форме создания/редактирования вида оборудования (Select с вариантами специализаций). В таблице — колонка «Специализация» с цветными тегами. Пустое значение (NULL) = доступно всем специализациям.

**Начальное наполнение:** 39 записей (38 активных, 1 деактивированный — vent). Включают 22 новых вида оборудования: ДГУ, МКГУ, ИБП, пассажирский/грузовой/грузопассажирский лифты, подъёмные платформы для инвалидов, ИТП, 4 типа котлов, прибор учёта газопотребления, сололифт, мобильный кондиционер, шлагбаум/рольставни, автоматические двери/ворота, кофе-машина, пурифаер, куллер, аквариум, пузырьковая панель.

#### 3.2.4. room_types — Типы помещений

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| name | VARCHAR(100) | ❌ | Наименование |
| code | VARCHAR(50) | ❌ | Код для маркировки фото (транслит) |

**Начальное наполнение:** 12 записей (см. раздел 6.3 ТЗ).

#### 3.2.5. recommendations — Типовые рекомендации

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| equipment_type_id | UUID | ❌ | FK → equipment_types.id |
| text | TEXT | ❌ | Текст рекомендации |
| sort_order | INT | ❌ | Порядок отображения |
| is_active | BOOLEAN | ❌ | Активна ли (default: true) |

**Индексы:**
- INDEX(equipment_type_id, sort_order)

**Начальное наполнение:** ~80 рекомендаций по 13 категориям (см. `Справочник типовых рекомендаций.md`).

#### 3.2.6. visits — Визиты

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| user_id | UUID | ❌ | FK → users.id (инженер) |
| address_id | UUID | ❌ | FK → addresses.id |
| engineer_name | VARCHAR(200) | ❌ | ФИО инженера (ввод вручную, автозаполнение из предыдущего визита) |
| date_start | DATE | ❌ | Дата начала визита |
| time_start | TIME | ❌ | Время начала |
| time_end | TIME | ✅ | Время окончания (авто при завершении) |
| season | ENUM('summer', 'winter') | ❌ | Сезон |
| status | ENUM('planned', 'not_started', 'in_progress', 'completed', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm') | ❌ | Статус визита |
| assigned_by_id | UUID FK → users? | ✅ | Кто назначил визит |
| assigned_at | TIMESTAMP? | ✅ | Дата назначения |
| sent_by_engineer_at | TIMESTAMP? | ✅ | Когда отправлено инженером |
| sent_by_tm_at | TIMESTAMP? | ✅ | Когда отправлено ТМ |
| tm_corrected | BOOLEAN | ❌ | ТМ вносил корректировки (default: false) |
| is_multi_specialist | BOOLEAN | ❌ | Визит по заявке «ИСЖ объекта» — допускается несколько инженеров с разными специализациями (default: false) |
| is_deleted | BOOLEAN | ❌ | Soft delete (default: false) |
| deleted_by_id | UUID FK → users? | ✅ | Кто удалил |
| deleted_at | TIMESTAMP? | ✅ | Дата удаления |
| created_at | TIMESTAMP | ❌ | Дата создания |
| updated_at | TIMESTAMP | ❌ | Дата обновления |

**Связи:**
- `importedRequests` → ImportedRequest[] (через `imported_requests.visit_id`, один-ко-многим — устаревшая прямая привязка)
- `visitRequests` → VisitRequest[] (через `visit_requests`, многие-ко-многим — актуальная связь с заявками)

**Индексы:**
- INDEX(user_id, date_start) — история визитов инженера
- INDEX(status)
- INDEX(is_deleted)

#### 3.2.7. tasks — Задачи чек-листа

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| visit_id | UUID | ❌ | FK → visits.id |
| task_type | VARCHAR(20) | ❌ | Тип задачи: `individual` (по умолчанию) или `group_climate` |
| equipment_type_id | UUID | ❌ | FK → equipment_types.id |
| room_type_id | UUID | ✅ | FK → room_types.id |
| room_type_code | VARCHAR(50) | ✅ | Код типа помещения (для групповых задач) |
| object_equipment_id | UUID | ✅ | FK → object_equipment.id (для индивидуальных задач) |
| comment | VARCHAR(200) | ✅ | Комментарий к задаче (бывшее location) |
| brand | VARCHAR(100) | ✅ | Марка оборудования |
| model | VARCHAR(100) | ✅ | Модель оборудования |
| serial_number | VARCHAR(100) | ✅ | Серийный номер |
| sort_order | INT | ❌ | Порядок отображения (default: 0) |
| status | ENUM('not_started', 'in_progress', 'completed') | ❌ | Статус задачи |
| parameters | JSONB | ✅ | Контролируемые параметры (структура зависит от типа оборудования) |
| selected_recommendation_ids | UUID[] | ✅ | Массив ID выбранных рекомендаций |
| additional_recommendations | TEXT | ✅ | Дополнительные рекомендации (свободный текст) |
| conclusion | ENUM('ok', 'ok_with_notes', 'faulty') | ❌ | Заключение |
| created_at | TIMESTAMP | ❌ | Дата создания |
| updated_at | TIMESTAMP | ❌ | Дата обновления |

**Индексы:**
- INDEX(visit_id, status)

**Структура JSONB-поля `parameters`** — различается для каждого типа оборудования (см. раздел 5).

#### 3.2.7.1. task_equipment_items — Единицы оборудования в групповой задаче

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| task_id | UUID | ❌ | FK → tasks.id (групповая задача) |
| object_equipment_id | UUID | ❌ | FK → object_equipment.id (конкретная единица) |
| status | VARCHAR(20) | ✅ | Статус единицы: 'ok' / 'not_ok' |
| sort_order | INT | ❌ | Порядок отображения (default: 0) |
| created_at | TIMESTAMP | ❌ | Дата создания |

**Индексы:**
- UNIQUE(task_id, object_equipment_id)
- INDEX(task_id)

#### 3.2.8. photos — Фотографии

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| task_id | UUID | ✅ | FK → tasks.id (для индивидуальных задач) |
| task_equipment_item_id | UUID | ✅ | FK → task_equipment_items.id (для групповых задач) |
| file_name | VARCHAR(255) | ❌ | Имя файла по шаблону маркировки |
| file_path | VARCHAR(500) | ❌ | Путь к файлу в хранилище |
| moment | ENUM('before', 'after') | ❌ | Момент съёмки |
| file_size | INT | ✅ | Размер файла в байтах |
| mime_type | VARCHAR(50) | ✅ | MIME-тип (image/jpeg) |
| hash | VARCHAR(64) | ✅ | SHA-256 хеш сжатого файла для проверки дубликатов |
| created_at | TIMESTAMP | ❌ | Дата создания |

**Индексы:**
- UNIQUE(task_id, moment) — не более одного фото ДО и одного ПОСЛЕ на индивидуальную задачу
- UNIQUE(task_equipment_item_id, moment) — не более одного фото ДО и одного ПОСЛЕ на единицу в групповой задаче
- INDEX(task_id, moment)
- INDEX(task_equipment_item_id, moment)
- INDEX(hash) — поиск дубликатов по хешу

> **Примечание:** Для индивидуальных задач заполняется `task_id`, для единиц в групповых задачах — `task_equipment_item_id`. Одно из двух полей всегда NULL.

#### 3.2.9. audit_log — Журнал аудита

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| user_id | UUID | ✅ | FK → users.id (NULL для системных событий) |
| action | VARCHAR(50) | ❌ | Тип действия (create, update, delete, login, logout) |
| entity_type | VARCHAR(50) | ❌ | Тип сущности (visit, task, address, user, etc.) |
| entity_id | UUID | ✅ | ID изменённой сущности |
| old_value | JSONB | ✅ | Предыдущее значение (для update) |
| new_value | JSONB | ✅ | Новое значение (для create/update) |
| ip_address | VARCHAR(45) | ✅ | IP-адрес пользователя |
| user_agent | TEXT | ✅ | User-Agent браузера |
| created_at | TIMESTAMP | ❌ | Дата и время действия |

**Индексы:**
- INDEX(user_id, created_at)
- INDEX(entity_type, entity_id)
- INDEX(action)

#### 3.2.10. password_reset_tokens — Токены сброса пароля

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| user_id | UUID | ❌ | FK → users.id |
| token | VARCHAR(255) | ❌ | Уникальный токен (crypto.randomBytes) |
| expires_at | TIMESTAMP | ❌ | Срок действия (1 час с создания) |
| used | BOOLEAN | ❌ | Использован ли токен (default: false) |
| created_at | TIMESTAMP | ❌ | Дата создания |

**Индексы:**
- UNIQUE(token)
- INDEX(user_id)

#### 3.2.11. object_equipment — Оборудование объектов

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| address_id | UUID FK → addresses | Ссылка на адрес |
| equipment_type_code | VARCHAR(50) | Код вида оборудования |
| room_type_code | VARCHAR(50) | Код типа помещения (**опционально**, nullable) |
| brand | VARCHAR(100) | Марка (опц.) |
| model | VARCHAR(100) | Модель (опц.) |
| serial_number | VARCHAR(100) | Серийный номер (опц.) |
| location_description | TEXT | Описание местоположения (опц.) |
| is_outdoor_unit | BOOLEAN | Наружный блок (default: false). TRUE для splitnar, mssnar, vrv_nar |
| is_active | BOOLEAN | Активна (default: true) |
| room_confirmed_at | TIMESTAMP | Дата первичного уточнения помещения инженером (опц.) |
| room_confirmed_by | UUID FK → users | Пользователь, уточнивший помещение (опц.) |
| confirmation_status | VARCHAR(20) | Статус подтверждения: `confirmed` (по умолчанию) или `pending` (создана инженером, ждёт подтверждения) |
| created_by | UUID FK → users (nullable) | Кто создал запись (для отслеживания) |
| pending_until | TIMESTAMP (nullable) | Дата истечения TTL. NULL для confirmed записей |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

**Уникальные ограничения:**
- (address_id, equipment_type_code, serial_number) — когда serial_number не null
- (address_id, equipment_type_code, location_description) — когда serial_number null

#### 3.2.12. equipment_proposals — Предложения оборудования

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| address_id | UUID FK → addresses | Ссылка на адрес |
| equipment_type_code | VARCHAR(50) | Код вида оборудования |
| room_type_code | VARCHAR(50) | Код типа помещения |
| brand | VARCHAR(100) | Марка (опц.) |
| model | VARCHAR(100) | Модель (опц.) |
| serial_number | VARCHAR(100) | Серийный номер (опц.) |
| location_description | TEXT | Описание местоположения (опц.) |
| proposed_by_id | UUID FK → users | Кто предложил |
| status | VARCHAR(20) | pending / approved / rejected / expired |
| reviewed_by_id | UUID FK → users (nullable) | Кто рассмотрел |
| reviewed_at | TIMESTAMP (nullable) | Дата рассмотрения |
| request_type | VARCHAR(20) | Тип запроса: `new_equipment` (по умолчанию), `room_change`, `brand_change` |
| old_room_type_code | VARCHAR(50) (nullable) | Код помещения, откуда переносится оборудование (для `room_change`) |
| rejection_reason | TEXT (nullable) | Причина отклонения администратором |
| pending_until | TIMESTAMP (nullable) | Дата автоматического истечения (TTL, 30 дней) |
| object_equipment_id | UUID FK → object_equipment (nullable) | Ссылка на существующую запись оборудования (для `room_change`) |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

**Индексы:**
- INDEX(request_type)
- INDEX(pending_until)
- Частичный индекс: INDEX(object_equipment_id, status) WHERE status = 'pending' — быстрая проверка конфликтующих переносов

#### 3.2.13. notifications — Уведомления пользователей

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| user_id | UUID FK → users | Получатель уведомления |
| type | VARCHAR(30) | Тип уведомления (см. ниже) |
| title | VARCHAR(200) | Заголовок |
| message | TEXT | Текст уведомления |
| entity_type | VARCHAR(30) (nullable) | Тип связанной сущности: `equipment_proposal` / `object_equipment` / `visit` / `system_release` |
| entity_id | UUID (nullable) | ID связанной сущности (для deep links) |
| is_read | BOOLEAN | Прочитано (default: false) |
| is_deleted | BOOLEAN | Мягкое удаление (default: false) |
| created_at | TIMESTAMP | Дата создания (default: NOW()) |

**Типы уведомлений (NotificationType):**

| Код | Описание |
|-----|----------|
| `proposal_created` | Создано предложение по оборудованию |
| `proposal_approved` | Предложение одобрено |
| `proposal_rejected` | Предложение отклонено |
| `proposal_expiring_soon` | TTL предложения истекает через 3 дня |
| `proposal_expired` | TTL предложения истёк |
| `equipment_removed` | Оборудование удалено из активного визита |
| `request_assigned` | Инженер назначен на заявку |
| `request_unassigned` | Инженер снят с заявки |
| `request_declined` | Инженер отказался от заявки |
| `request_imported` | Новые заявки импортированы |
| `system_release` | Системное уведомление о новом релизе |

**Индексы:**
- INDEX(user_id, is_deleted, is_read) — составной для фильтрации активных уведомлений
- INDEX(created_at)

**Prisma-модель:**
```prisma
model Notification {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  type       String
  title      String   @db.VarChar(200)
  message    String
  entityType String?  @map("entity_type")
  entityId   String?  @map("entity_id")
  isRead     Boolean  @default(false) @map("is_read")
  isDeleted  Boolean  @default(false) @map("is_deleted")
  createdAt  DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isDeleted, isRead])
  @@index([createdAt])
  @@map("notifications")
}
```

#### 3.2.13.1. system_releases — История релизов

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| version | VARCHAR(50) | Версия (например, `v2.4.0`) — UNIQUE |
| release_notes | TEXT | Текст релиза |
| deployed_at | TIMESTAMP | Дата деплоя (default: NOW()) |
| deployed_by | VARCHAR(50) | Источник: `ci_webhook` или `admin_manual` |
| admin_id | UUID FK → users (nullable) | ID админа (если создано вручную) |
| notification_count | INT | Количество созданных уведомлений (default: 0) |

**Индексы:**
- UNIQUE(version) — защита от дубликатов при повторном деплое

#### 3.2.14. user_favorite_objects — Избранные объекты пользователей

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| user_id | UUID FK → users | Пользователь |
| object_code | VARCHAR(50) FK → addresses.object_code | Код объекта |
| added_at | TIMESTAMP | Дата добавления (default: NOW()) |

**Уникальные ограничения:**
- UNIQUE(user_id, object_code) — один объект не может быть добавлен дважды
- Максимум 20 записей на одного пользователя (валидация на уровне приложения)

**Индексы:**
- INDEX(user_id)
- INDEX(object_code)

**Поведение:**
- Избранные объекты синхронизируются с IndexedDB для офлайн-доступа
- Инженер и ТМ могут добавлять/удалять объекты из избранного через ЛК
- Администратор не имеет доступа к избранному

#### 3.2.15. report_attachments — Вложения сводных отчётов (сканы актов)

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| report_task_id | UUID FK → report_tasks (nullable) | Привязка к задаче генерации отчёта |
| file_path | TEXT | Путь к файлу на сервере (uploads/act-scans/) |
| file_type | VARCHAR(10) | 'image' или 'pdf' |
| original_name | VARCHAR(255) | Исходное имя файла |
| file_size | INTEGER | Размер сжатого файла (байты) |
| uploaded_by | UUID FK → users | Кто загрузил |
| created_at | TIMESTAMP | Дата загрузки |

**Индексы:** INDEX(report_task_id)

#### 3.2.16. report_tasks — Задачи генерации сводных отчётов

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| type | VARCHAR(20) | 'period' или 'objects' |
| params | JSONB | Параметры запроса (dateFrom, dateTo, addressIds и т.д.) |
| status | VARCHAR(20) | 'processing' / 'ready' / 'error' (default: 'processing') |
| pdf_path | TEXT (nullable) | Путь к сгенерированному PDF |
| photos_zip_path | TEXT (nullable) | Путь к ZIP с фото (упрощённый режим) |
| error_message | TEXT (nullable) | Сообщение об ошибке |
| created_by | UUID FK → users | Кто сформировал |
| created_at | TIMESTAMP | Дата создания |
| completed_at | TIMESTAMP (nullable) | Дата завершения генерации |

#### 3.2.17. imported_requests — Импортированные заявки

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| external_request_id | VARCHAR(50) | ❌ | Номер заявки из внешней системы (уникальный) |
| external_status | VARCHAR(50) | ✅ | Статус заявки во внешней системе |
| equipment_type_id | UUID | ❌ | FK → equipment_types.id (вид оборудования) |
| equipment_type_code | VARCHAR(50) | ✅ | Код вида оборудования (на момент импорта) |
| object_code | VARCHAR(50) | ❌ | Код объекта (из addresses.object_code) |
| address_raw | TEXT | ✅ | Адрес из файла импорта (до нормализации) |
| matched_address_id | UUID | ✅ | FK → addresses.id (найденный адрес) |
| visit_id | UUID | ✅ | FK → visits.id (прямая привязка визита — устаревшая, см. `visit_requests`) |
| import_status | VARCHAR(20) | ❌ | Статус импорта: `new`, `processed`, `error`, `skipped` (default: `new`) |
| error_message | TEXT | ✅ | Текст ошибки при импорте |
| imported_by | UUID | ✅ | FK → users.id (кто импортировал) |
| imported_at | TIMESTAMP | ❌ | Дата импорта |
| created_at | TIMESTAMP | ❌ | Дата создания |

**Индексы:**
- UNIQUE(external_request_id)
- INDEX(import_status)
- INDEX(object_code)
- INDEX(visit_id)

**Связи:**
- `visitRequests` → VisitRequest[] (многие-ко-многим с визитами через связующую таблицу)

> **Примечание:** Поле `visit_id` — устаревший способ привязки (один-ко-многим: одна заявка → один визит). Актуальная связь — через таблицу `visit_requests` (многие-ко-многим: несколько визитов ↔ несколько заявок).

#### 3.2.18. visit_requests — Связь визитов с заявками (многие-ко-многим)

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| visit_id | UUID | ❌ | FK → visits.id (визит) |
| imported_request_id | UUID | ❌ | FK → imported_requests.id (заявка) |
| created_at | TIMESTAMP | ❌ | Дата создания связи |

**Индексы:**
- UNIQUE(visit_id, imported_request_id) — защита от дубликатов
- INDEX(visit_id) — быстрый поиск заявок по визиту
- INDEX(imported_request_id) — быстрый поиск визитов по заявке

**Бизнес-логика:**
- Связующая таблица для отношения многие-ко-многим между визитами и заявками
- **Заявка «ИСЖ объекта»** — заявка, у которой `equipment_type_code` соответствует специальному виду «ИСЖ объекта». Такая заявка подразумевает ТО **всего** оборудования объекта, и каждый инженер (с разной специализацией) создаёт свой визит. Все визиты связываются с одной и той же заявкой через `visit_requests`
- **Автопривязка при создании визита (все роли):** когда визит создаётся на объект (независимо от роли — инженер, ТМ, администратор), система ищет заявки типа «ИСЖ объекта» по `object_code` этого объекта с фильтром по периоду (`startDate <= visitDate <= deadline`) и автоматически создаёт записи в `visit_requests`. Для ИСЖ объекта: одна заявка → много визитов (разные инженеры), без фильтра по статусу виртуального визита
- **Автопривязка при завершении визита:** при `POST /api/visits/:id/complete` система дополнительно привязывает заявки на конкретное оборудование по типам задач визита. Фильтр по периоду: `startDate <= visitDate <= deadline`. Для конкретного оборудования: одна заявка → один визит (1:1), только если заявка ещё не привязана к другому визиту. Защита от дубликатов: если несколько заявок с одинаковым адресом и периодом — привязка только к первой
- **Автопривязка при создании задачи:** при создании задачи система ищет заявки на конкретное оборудование (по `equipment_type_code`) для данного объекта и автоматически привязывает через `visit_requests`
- **Статусы заявок ИСЖ объекта:** для заявок типа «ИСЖ объекта» статус исполнения определяется агрегированно по всем связанным визитам через `visit_requests`. Нет визитов → «Не назначена»; все визиты в `not_started`/`planned` → «Назначена»; есть `in_progress` или частичное покрытие → «В работе»; все специализации (ВИК+ИСЖ) покрыты завершёнными визитами → «Завершена»
- **Проверка задач при вычислении статуса заявки (`computeExecutionStatus`):** функция `computeExecutionStatus` принимает `equipmentTypeId` заявки. Для не-ИСЖ заявок статус «Завершён» требует наличия задачи по типу оборудования заявки (`tasks` с совпадающим `equipmentTypeId`) в связанном визите. Если задача отсутствует — статус возвращается в «Не назначена». Запрос визита включает `tasks: { select: { equipmentTypeId: true } }` для проверки
- **Отображение в списке визитов:** API возвращает объединённый список номеров заявок из `importedRequests` (прямая привязка по `visit_id`) и из `visitRequests → importedRequest` (связь через таблицу). В UI показываются первые 2 номера + счётчик «+N»

#### 3.2.19. visit_engineers — Привязка инженеров к визиту (заявки)

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| visit_id | UUID | ❌ | FK → visits.id |
| engineer_id | UUID | ❌ | FK → users.id |
| is_primary | BOOLEAN | ❌ | Основной инженер (default: false) |
| assigned_by | UUID | ✅ | FK → users.id (кто назначил) |
| assigned_at | TIMESTAMP | ❌ | Дата назначения |
| created_at | TIMESTAMP | ❌ | Дата создания |

**Индексы:**
- UNIQUE(visit_id, engineer_id)
- INDEX(visit_id)
- INDEX(engineer_id)

#### 3.2.20. request_assignment_log — История действий с заявками

| Поле | Тип | Nullable | Описание |
|------|-----|:--------:|----------|
| id | UUID | ❌ | Первичный ключ |
| imported_request_id | UUID | ❌ | FK → imported_requests.id |
| action | VARCHAR(30) | ❌ | Действие: `assigned`, `unassigned`, `declined` |
| engineer_id | UUID | ✅ | FK → users.id (инженер) |
| performed_by | UUID | ✅ | FK → users.id (кто выполнил) |
| reason | TEXT | ✅ | Причина (для `declined`) |
| created_at | TIMESTAMP | ❌ | Дата действия |

**Индексы:**
- INDEX(imported_request_id)
- INDEX(created_at)

---

## См. также

- [API-контракты](api-contracts.md) — REST API системы
- [Структура параметров JSONB](params-jsonb.md) — форматы JSONB-полей задач
- [Бизнес-логика](business-logic.md) — правила валидации и workflow
- [Безопасность](security.md) — аутентификация и защита данных

---

## 4. API-КОНТРАКТЫ