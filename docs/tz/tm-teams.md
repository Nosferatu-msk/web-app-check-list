# Проект: Команды ТМ

## Содержание

- [Бизнес-обоснование](#бизнес-обоснование)
- [1. Модель данных](#1-модель-данных)
  - [Новая таблица tm_team_member](#новая-таблица-tm_team_member)
  - [Добавления в модель User](#добавления-в-модель-user)
- [2. Серверная логика](#2-серверная-логика)
  - [2.1. Унифицированная функция getTeamEngineerIds](#21-унифицированная-функция-getteamengineerids)
  - [2.2. Точки замены](#22-точки-замены)
  - [2.3. Точки, которые НЕ меняются](#23-точки-которые-не-меняются)
- [3. API для управления командами (админ)](#3-api-для-управления-командами-админ)
- [4. Клиентский UI (админка)](#4-клиентский-ui-админка)
- [5. Бизнес-сценарии — проверка](#5-бизнес-сценарии--проверка)
- [6. Миграция данных](#6-миграция-данных)
- [7. Файлы для изменения](#7-файлы-для-изменения)
- [8. Порядок реализации](#8-порядок-реализации)

## Бизнес-обоснование

Для одного договора могут быть назначены несколько ТМ (сотрудники бэк-офиса), которые совместно работают с одними и теми же инженерами. Текущая модель позволяет инженеру быть привязанным только к одному ТМ, что исключает коллективный доступ.

**Решение (Подход А):** Инженер привязан к основному ТМ. ТМ2 (члены команды) видят инженеров и их визиты через связь с лидером команды.

---

## 1. Модель данных

### Новая таблица `tm_team_member`

```prisma
model TmTeamMember {
  id         String   @id @default(uuid())
  memberTmId String   @unique @map("member_tm_id")  // ТМ2 (член команды)
  leadTmId   String   @map("lead_tm_id")            // основной ТМ (лидер)
  createdAt  DateTime @default(now()) @map("created_at")

  memberTm User @relation("TmTeamMemberRelation", fields: [memberTmId], references: [id], onDelete: Cascade)
  leadTm   User @relation("TmTeamLeadRelation", fields: [leadTmId], references: [id], onDelete: Cascade)

  @@index([leadTmId])
  @@map("tm_team_member")
}
```

**Ограничения:**
- `@@unique([memberTmId])` — один ТМ2 может быть только в одной команде (у одного лидера)
- Один лидер может иметь несколько ТМ2 (one-to-many)
- Лидер не может быть ТМ2 у другого лидера (защита от рекурсии)

### Добавления в модель User

```prisma
// В модели User добавить:
tmTeamAsMember     TmTeamMember? @relation("TmTeamMemberRelation")  // ТМ2 как член команды
tmTeamAsLead       TmTeamMember[] @relation("TmTeamLeadRelation")   // ТМ как лидер (список ТМ2)
```

---

## 2. Серверная логика

### 2.1. Унифицированная функция `getTeamEngineerIds`

Заменить дублирующуюся `getTmEngineerIds` (определена в visits.ts:21 и reports.ts:123) на единую функцию:

```typescript
// server/src/utils/tmTeam.ts

/**
 * Получить ID всех инженеров, доступных ТМ (включая инженеров ТМ2 его команды).
 * - Свои инженеры (TmEngineer where tmId)
 * - Инженеры всех ТМ2, где leadTmId = tmId
 */
export async function getTeamEngineerIds(tmId: string): Promise<string[]> {
  // 1. Свои инженеры
  const ownEngineers = await prisma.tmEngineer.findMany({
    where: { tmId },
    select: { engineerId: true },
  });

  // 2. ТМ2 в команде (где этот ТМ — лидер)
  const teamMembers = await prisma.tmTeamMember.findMany({
    where: { leadTmId: tmId },
    select: { memberTmId: true },
  });

  // 3. Инженеры ТМ2
  const memberIds = teamMembers.map(m => m.memberTmId);
  let teamEngineers: string[] = [];
  if (memberIds.length > 0) {
    const teamEng = await prisma.tmEngineer.findMany({
      where: { tmId: { in: memberIds } },
      select: { engineerId: true },
    });
    teamEngineers = teamEng.map(e => e.engineerId);
  }

  // 4. Объединение без дубликатов
  return [...new Set([...ownEngineers.map(e => e.engineerId), ...teamEngineers])];
}

/**
 * Получить ID всех ТМ в команде (лидер + ТМ2).
 * Используется для проверки доступа.
 */
export async function getTeamTmIds(tmId: string): Promise<string[]> {
  const members = await prisma.tmTeamMember.findMany({
    where: { leadTmId: tmId },
    select: { memberTmId: true },
  });
  return [tmId, ...members.map(m => m.memberTmId)];
}
```

### 2.2. Точки замены

| # | Файл | Строка | Текущий код | Замена |
|---|------|--------|-------------|--------|
| 1 | `visits.ts` | 21 | `function getTmEngineerIds` (определение) | **Удалить**, импорт из `tmTeam.ts` |
| 2 | `reports.ts` | 123 | `function getTmEngineerIds` (определение) | **Удалить**, импорт из `tmTeam.ts` |
| 3 | `visits.ts` | 41 | `getTmEngineerIds(req.userId!)` в canAccessVisit | → `getTeamEngineerIds(req.userId!)` |
| 4 | `visits.ts` | 45 | `getTmEngineerIds(req.userId!)` в canAccessVisit | → `getTeamEngineerIds(req.userId!)` |
| 5 | `visits.ts` | 366 | `getTmEngineerIds(req.userId!)` в GET / | → `getTeamEngineerIds(req.userId!)` |
| 6 | `visits.ts` | 822 | `getTmEngineerIds(req.userId!)` в reassign | → `getTeamEngineerIds(req.userId!)` |
| 7 | `reports.ts` | 317 | `getTmEngineerIds(req.userId!)` в GET / | → `getTeamEngineerIds(req.userId!)` |
| 8 | `analyticsService.ts` | 26 | `prisma.tmEngineer.findMany({ where: { tmId } })` | → `getTeamEngineerIds(userId)` |
| 9 | `analyticsService.ts` | 203 | `prisma.tmEngineer.findFirst({ where: { tmId, engineerId } })` | → проверка `getTeamEngineerIds(tmId)` включает visit.userId |
| 10 | `requests.ts` | 276 | `prisma.tmEngineer.findMany({ where: { tmId } })` | → `getTeamEngineerIds(tmId)` |
| 11 | `refs.ts` | 256 | `prisma.tmEngineer.findMany({ where: { tmId } })` — список инженеров для ТМ | → `getTeamEngineerIds(tmId)` + вернуть данные инженеров |

### 2.3. Точки, которые НЕ меняются

| # | Файл | Строка | Почему не меняется |
|---|------|--------|-------------------|
| A | `visits.ts` | 142 | Создание визита инженером — `findUnique({ engineerId })` находит основного ТМ. Адрес проверяется через TmObject основного ТМ. **Не менять** — инженер всегда привязан к одному ТМ. |
| B | `visits.ts` | 176 | Автоподстановка договора — аналогично, через основного ТМ. **Не менять**. |
| C | `refs.ts` | 40 | Адреса для инженера — через основного ТМ. **Не менять**. |
| D | `admin.ts` | 349-375 | CRUD привязок ТМ-инженер — управляет TmEngineer. **Не менять**, но добавить CRUD для tm_team_member. |
| E | `import.ts` | 416, 512, 517 | Импорт привязок — работает с TmEngineer. **Не менять**. |
| F | `profile.ts` | 206 | ТМ создаёт инженера — привязка к основному ТМ. **Не менять**. |

---

## 3. API для управления командами (админ)

### Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/admin/tm-team` | Список всех записей команды (leadTm → memberTm) |
| `POST` | `/api/admin/tm-team` | Добавить ТМ2 к лидеру `{ memberTmId, leadTmId }` |
| `DELETE` | `/api/admin/tm-team/:memberTmId` | Убрать ТМ2 из команды |

### Валидация

```typescript
const tmTeamSchema = z.object({
  memberTmId: z.string().uuid(),
  leadTmId: z.string().uuid(),
});
```

**Проверки при создании:**
1. Оба пользователя существуют и имеют роль `tm`
2. memberTmId !== leadTmId (нельзя быть лидером самому себе)
3. memberTmId ещё не привязан к другому лидеру (unique constraint)
4. Нет рекурсии: leadTmId не является ТМ2 у memberTmId (защита от циклов)

---

## 4. Клиентский UI (админка)

### Страница `AdminTmAssignments` — новая вкладка «Команды»

**Расположение:** третья вкладка на существующей странице привязок ТМ (после «Объекты» и «Инженеры»).

**UI:**
- Select «Лидер (ТМ)» — выбор основного ТМ
- Кнопка «Добавить ТМ2» — модальное окно с Select «ТМ2» (список всех ТМ, исключая уже привязанных и самого лидера)
- Таблица записей команды:
  - Колонки: Лидер | ТМ2 (член команды) | Дата | Действия
  - Фильтр по лидеру
  - Удаление с подтверждением (Popconfirm)

---

## 5. Бизнес-сценарии — проверка

### Видимость данных

| Сценарий | Ожидаемый результат | Как достигается |
|----------|-------------------|----------------|
| ТМ (лидер) видит список визитов | Визиты своих инженеров + визиты инженеров ТМ2 | `getTeamEngineerIds` включает всех |
| ТМ2 видит список визитов | Только визиты общих инженеров | ТМ2 → TmEngineer → те же инженеры |
| ТМ видит заявку | Назначенную на инженера из команды | `getTeamEngineerIds` в requests.ts |
| ТМ2 видит заявку | Назначенную на инженера из команды | Аналогично |
| Отчёт ТМ | Визиты всех инженеров команды | `getTeamEngineerIds` в reports.ts |
| Аналитика ТМ | Данные всех инженеров команды | `getTeamEngineerIds` в analyticsService |

### Доступ к операциям

| Сценарий | Ожидаемый результат | Как достигается |
|----------|-------------------|----------------|
| ТМ2 открывает визит инженера | ✅ Доступ | `canAccessVisit` → `getTeamEngineerIds` включает |
| ТМ2 корректирует визит | ✅ Может | canAccessVisit + role === 'tm' |
| ТМ2 переназначает визит | ✅ На любого инженера команды | reassign → `getTeamEngineerIds` |
| ТМ2 удаляет визит | ✅ Может | canAccessVisit + role check |
| Инженер создаёт визит | Привязка к основному ТМ (без изменений) | findUnique(engineerId) → ТМ → TmObject |

### Отсутствие дублирования

| Сценарий | Проверка |
|----------|---------|
| Визит в списке ТМ | `WHERE userId IN (engineerIds)` — каждый визит имеет одного инженера → одна запись |
| Отчёт ТМ | Те же engineerIds — дублей нет |
| Аналитика | Фильтрация по engineerIds — каждый визит учтён один раз |

### Граничные случаи

| Сценарий | Поведение |
|----------|----------|
| У ТМ нет ТМ2 | `getTeamEngineerIds` = `getTmEngineerIds` (только свои инженеры) |
| ТМ2 удалили из команды | ТМ2 теряет доступ к визитам инженеров (нет своих) |
| Лидер деактивирован | ТМ2 остаётся, но лидер не видит его визиты (неактивен) |
| ТМ2 назначен лидером другого ТМ | Запрещено валидацией (защита от рекурсии) |

---

## 6. Миграция данных

Существующие данные не требуют миграции — таблица `tm_team_member` создаётся пустой. Команды формируются администратором через UI.

---

## 7. Файлы для изменения

| Файл | Изменение |
|------|----------|
| `server/prisma/schema.prisma` | Новая модель TmTeamMember + relations в User |
| `server/src/utils/tmTeam.ts` | **Новый файл** — getTeamEngineerIds, getTeamTmIds |
| `server/src/routes/visits.ts` | Удалить локальную getTmEngineerIds, заменить 4 вызова |
| `server/src/routes/reports.ts` | Удалить локальную getTmEngineerIds, заменить 1 вызов |
| `server/src/routes/requests.ts` | Заменить прямой запрос на getTeamEngineerIds |
| `server/src/routes/refs.ts` | Заменить прямой запрос на getTeamEngineerIds (список инженеров) |
| `server/src/services/analyticsService.ts` | Заменить 2 прямых запроса на getTeamEngineerIds |
| `server/src/routes/admin.ts` | Добавить CRUD для tm_team_member |
| `client/src/pages/admin/AdminTmAssignments.tsx` | Добавить вкладку «Команды» |

**Итого:** 1 новый файл, 8 изменённых файлов, 1 миграция.

---

## 8. Порядок реализации

1. Миграция БД (schema.prisma + prisma migrate)
2. Утилита `tmTeam.ts`
3. Замена в серверных файлах (visits, reports, requests, refs, analytics)
4. API для управления командами (admin.ts)
5. UI в админке (AdminTmAssignments.tsx)
6. Тестирование на production
7. Обновление документации (ТЗ, Спецификация, Тест-кейсы)

---

## См. также

- [module-tm.md](module-tm.md) — Модуль «Территориальный менеджер»: функциональные требования
- [Тест-кейсы: ТМ и команды](../test-cases/tm.md) — тесты модуля ТМ и команд
- [Спецификация: Модель данных](../specs/data-model.md) — описание таблиц tm_team_member, tm_engineer
- [Спецификация: API-контракты](../specs/api-contracts.md) — эндпоинты API для ТМ
