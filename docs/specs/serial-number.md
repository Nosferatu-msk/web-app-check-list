# Спецификация и декомпозиция: Привязка заявок к оборудованию по серийному номеру

**Дата:** 14.10.2026  
**Основание:** `../tz/serial-number.md` (утверждено, ревью пройдено)

---

## Содержание

- [Часть 1. Спецификация](#часть-1-спецификация)
  - [СП-1. Модель данных](#сп-1-модель-данных)
  - [СП-2. Импорт заявок](#сп-2-импорт-заявок)
  - [СП-3. Автопривязка в визитах](#сп-3-автопривязка-в-визитах)
  - [СП-4. API редактирования serialNumber](#сп-4-api-редактирования-serialnumber)
  - [СП-5. Миграция данных](#сп-5-миграция-данных)
  - [СП-6. UI — страница заявок](#сп-6-ui--страница-заявок)
  - [СП-7. Отчёты](#сп-7-отчёты)
  - [СП-8. Вычисление статуса заявки](#сп-8-вычисление-статуса-заявки)
- [Часть 2. Декомпозиция](#часть-2-декомпозиция)
- [Часть 3. Ревью на соответствие ТЗ](#часть-3-ревью-на-соответствие-тз)
- [Итого](#итого)

## Часть 1. Спецификация

### СП-1. Модель данных

#### СП-1.1. Prisma schema

**Файл:** `server/prisma/schema.prisma`

**Изменение:** добавить поле в модель `ImportedRequest` (после поля `contractId`):

```prisma
model ImportedRequest {
  // ... существующие поля ...
  contractId        String?      @map("contract_id")
  serialNumber      String?      @map("serial_number")  // ← НОВОЕ
  requestType       RequestType? @map("request_type")
  // ...
}
```

**Индекс** (в конце модели):
```prisma
@@index([serialNumber])
```

#### СП-1.2. Миграция БД

**Команда:** `npx prisma migrate dev --name add_serial_number_to_imported_requests`

**Ожидаемый SQL:**
```sql
ALTER TABLE imported_requests ADD COLUMN serial_number TEXT;
CREATE INDEX "imported_requests_serial_number_idx" ON "imported_requests"("serial_number");
```

#### СП-1.3. Shared types

**Файл:** `shared/types/index.ts`

**Изменение:** в интерфейсе `ImportedRequest` добавить поле:
```typescript
export interface ImportedRequest {
  // ... существующие поля ...
  contractId?: string;
  serialNumber?: string | null;  // ← НОВОЕ
  requestType?: 'planned' | 'unplanned';
  // ...
}
```

---

### СП-2. Импорт заявок

**Файл:** `server/src/services/requestImport.ts`

#### СП-2.1. Структуры данных

**RequestRow** — добавить поле:
```typescript
interface RequestRow {
  // ... существующие поля ...
  startDateRaw: string;
  serialNumber: string;  // ← НОВОЕ
}
```

**ParsedRequest** — добавить поле:
```typescript
interface ParsedRequest {
  // ... существующие поля ...
  startDate: Date | null;
  deadline: Date | null;
  serialNumber: string | null;  // ← НОВОЕ
  error: string | null;
}
```

#### СП-2.2. Парсинг Excel

**Функция:** `parseRequestsExcel(buffer)` (строки ~49-96)

**Изменение:** в цикле парсинга строк добавить:
```typescript
const serialNumber = findCol(['серийный №', 'серийный номер', 'серийник', 'serial number', 's/n']);
```

И в объекте `rows.push({...})`:
```typescript
rows.push({
  // ... существующие поля ...
  startDateRaw,
  serialNumber,  // ← НОВОЕ
});
```

#### СП-2.3. Нормализация serialNumber

**Функция:** `validateAndMapRow(...)` (строки ~115-198)

**Изменение:** после валидации `requestType` (пункт 3), добавить:
```typescript
// 3.5. Серийный номер
result.serialNumber = row.serialNumber?.trim() || null;
```

#### СП-2.4. Валидация дубликатов

**Функция:** `importRequests(rows, userId, importLogId)` (строки ~203-340)

**Изменение:** **ПОСЛЕ** цикла валидации (когда `parsedRows` заполнен), добавить проверку дубликатов в файле:

```typescript
// Проверка дубликатов (equipmentTypeCode + serialNumber) в файле
// Выполняется ПОСЛЕ заполнения parsedRows
const snDuplicates = new Map<string, number[]>(); // key → rowNumbers
for (const parsed of parsedRows) {
  if (parsed.error || parsed.isSkipped) continue;
  const sn = parsed.serialNumber;
  if (!sn || !parsed.equipmentTypeCode || parsed.equipmentTypeCode === 'iszh_object') continue;
  const key = `${parsed.equipmentTypeCode}::${sn}`;
  if (!snDuplicates.has(key)) snDuplicates.set(key, []);
  snDuplicates.get(key)!.push(parsed.row.rowNumber);
}
for (const [key, rowNumbers] of snDuplicates) {
  if (rowNumbers.length > 1) {
    const sn = key.split('::')[1];
    for (const rn of rowNumbers) {
      const parsed = parsedRows.find(p => p.row.rowNumber === rn);
      if (parsed) {
        parsed.error = `Файл содержит две и более заявок на одно и то же оборудование (serialNumber: ${sn})`;
        parsed.isSkipped = true;
      }
    }
  }
}
```

**Проверка дубликатов в БД** — в `validateAndMapRow`, после проверки `fileRequestIds`:
```typescript
// Проверка дубликата в БД (по периоду)
if (result.serialNumber && result.equipmentTypeCode && result.equipmentTypeCode !== 'iszh_object') {
  const existingInPeriod = await prisma.importedRequest.findFirst({
    where: {
      equipmentTypeCode: result.equipmentTypeCode,
      serialNumber: result.serialNumber,
      // Пересечение периодов
      NOT: {
        OR: [
          { deadline: { lt: result.startDate } },
          { startDate: { gt: result.deadline } },
        ],
      },
    },
    select: { externalRequestId: true },
  });
  if (existingInPeriod) {
    result.error = `Заявка на оборудование с серийным номером ${result.serialNumber} уже существует в данном отчётном периоде (заявка № ${existingInPeriod.externalRequestId})`;
    return result;
  }
}
```

#### СП-2.5. Сохранение serialNumber

**Функция:** `importRequests` — в цикле создания `importedRequest`:

```typescript
await prisma.importedRequest.create({
  data: {
    // ... существующие поля ...
    serialNumber: parsed.serialNumber,  // ← НОВОЕ
    importStatus: 'created',
    importedBy: userId,
  },
});
```

#### СП-2.6. Автопривязка при импорте

**Функция:** `importRequests` — после создания `importedRequest` (для не-ИСЖ с serialNumber):

```typescript
// Автопривязка к существующему визиту (если найден)
if (parsed.serialNumber && parsed.equipmentTypeCode !== 'iszh_object') {
  const matchingVisit = await findMatchingVisit(
    parsed.matchedAddressId!,
    parsed.contractId,
    parsed.equipmentTypeCode,
    parsed.serialNumber,
    parsed.startDate!,
    parsed.deadline!,
  );
  if (matchingVisit) {
    await prisma.visitRequest.create({
      data: { visitId: matchingVisit.id, importedRequestId: importedRequest.id },
    });
    await prisma.importedRequest.update({
      where: { id: importedRequest.id },
      data: { visitId: matchingVisit.id },
    });
  }
}
```

**Вспомогательная функция** `findMatchingVisit` (вынести в utils):
```typescript
async function findMatchingVisit(
  addressId: string,
  contractId: string | null,
  equipmentTypeCode: string,
  serialNumber: string,
  startDate: Date,
  deadline: Date,
): Promise<Visit | null> {
  // 1. Поиск по individual задачам
  const visit = await prisma.visit.findFirst({
    where: {
      addressId,
      isDeleted: false,
      status: { not: 'awaiting_assignment' },
      dateStart: { gte: startDate, lte: deadline },
      ...(contractId ? { contractId } : {}),
      tasks: {
        some: {
          equipmentType: { code: equipmentTypeCode },
          OR: [
            { serialNumber },
            { objectEquipment: { serialNumber, equipmentTypeCode } },
          ],
        },
      },
      // Заявка ещё не привязана к этому визиту
      visitRequests: {
        none: {
          importedRequest: {
            equipmentTypeCode,
            serialNumber,
          },
        },
      },
    },
  });
  if (visit) return visit;

  // 2. Поиск по group_climate задачам (через TaskEquipmentItem)
  const groupVisit = await prisma.visit.findFirst({
    where: {
      addressId,
      isDeleted: false,
      status: { not: 'awaiting_assignment' },
      dateStart: { gte: startDate, lte: deadline },
      ...(contractId ? { contractId } : {}),
      tasks: {
        some: {
          taskType: 'group_climate',
          equipmentItems: {
            some: {
              objectEquipment: { serialNumber, equipmentTypeCode },
            },
          },
        },
      },
      visitRequests: {
        none: {
          importedRequest: {
            equipmentTypeCode,
            serialNumber,
          },
        },
      },
    },
  });
  return groupVisit;
}
```

---

### СП-3. Автопривязка в визитах

**Файл:** `server/src/routes/visits.ts`

#### СП-3.1. При создании визита (строки ~200-330)

**Текущая логика:** ищет только ИСЖ заявки по `matchedAddressId`.

**Изменение:** НЕ ТРЕБУЕТСЯ. Автопривязка не-ИСЖ заявок при создании визита **не работает**, т.к. задачи добавляются отдельным POST-запросом после создания визита. Привязка происходит в двух других точках:
- При добавлении задачи (СП-3.2)
- При завершении визита (СП-3.4)

ИСЖ-привязка при создании визита — **без изменений**.

#### СП-3.2. При добавлении задачи (строки ~995-1060)

**Текущая логика:** ищет заявки по `matchedAddressId + equipmentTypeId`.

**Изменение:** заменить фильтр на поиск по serialNumber:

```typescript
// Текущий код (строка ~1010):
const matchingRequests = await prisma.importedRequest.findMany({
  where: {
    matchedAddressId: addressId,
    equipmentTypeId,
    equipmentType: { code: { not: 'iszh_object' } },
    visit: { status: { in: ['awaiting_assignment', 'planned'] } },
    startDate: { lte: visitDate },
    deadline: { gte: visitDate },
  },
});

// Новый код:
const taskSN = data.serialNumber || null; // из данных задачи
if (!taskSN) {
  // Задача без serialNumber — привязка по serialNumber не работает
  // (старая логика по equipmentTypeId отключена)
  return; // или continue, если в цикле
}
const matchingRequests = await prisma.importedRequest.findMany({
  where: {
    matchedAddressId: addressId,
    equipmentType: { code: { not: 'iszh_object' } },
    serialNumber: taskSN,  // ← точное совпадение, никогда null
    startDate: { lte: visitDate },
    deadline: { gte: visitDate },
    visitRequests: { none: {} },  // ← ещё не привязана
    ...(visit.contractId ? { contractId: visit.contractId } : {}),
  },
});
```

**Для `group_climate`:** после создания задачи и `TaskEquipmentItem`, перебрать items и для каждого искать заявку:
```typescript
if (data.taskType === 'group_climate' && data.equipmentItemIds?.length > 0) {
  for (const itemId of data.equipmentItemIds) {
    const objEquip = await prisma.objectEquipment.findUnique({ where: { id: itemId } });
    if (!objEquip?.serialNumber) continue;
    const matchedRequest = await prisma.importedRequest.findFirst({
      where: {
        matchedAddressId: addressId,
        equipmentTypeCode: objEquip.equipmentTypeCode,
        serialNumber: objEquip.serialNumber,
        startDate: { lte: visitDate },
        deadline: { gte: visitDate },
        visitRequests: { none: {} },
        ...(visit.contractId ? { contractId: visit.contractId } : {}),
      },
    });
    if (matchedRequest) {
      await prisma.visitRequest.create({ data: { visitId: visit.id, importedRequestId: matchedRequest.id } });
      await prisma.importedRequest.update({ where: { id: matchedRequest.id }, data: { visitId: visit.id } });
    }
  }
}
```

#### СП-3.3. При завершении визита (строки ~760-820)

**Текущая логика:** ищет заявки по `matchedAddressId + equipmentTypeId` из задач.

**Изменение:** аналогично СП-3.2 — заменить фильтр на поиск по serialNumber задач. Для каждой задачи визита с serialNumber — искать заявку с тем же serialNumber.

```typescript
// В блоке автопривязки при завершении (после ИСЖ-логики):
// 2. Привязка заявок на конкретное оборудование (по serialNumber задач)
for (const task of existing.tasks) {
  const taskSN = task.serialNumber || task.objectEquipment?.serialNumber;
  if (!taskSN) continue; // пропускаем задачи без serialNumber
  
  const eqCode = task.equipmentType?.code;
  if (!eqCode || eqCode === 'iszh_object') continue;

  const matchedRequest = await prisma.importedRequest.findFirst({
    where: {
      matchedAddressId: existing.addressId,
      equipmentTypeCode: eqCode,
      serialNumber: taskSN,
      startDate: { lte: visitDate },
      deadline: { gte: visitDate },
      visitRequests: { none: {} }, // ещё не привязана
      ...(existing.contractId ? { contractId: existing.contractId } : {}),
    },
  });

  if (matchedRequest) {
    await prisma.visitRequest.create({
      data: { visitId: existing.id, importedRequestId: matchedRequest.id },
    });
    await prisma.importedRequest.update({
      where: { id: matchedRequest.id },
      data: { visitId: existing.id },
    });
  }
}

// Для group_climate задач — перебор TaskEquipmentItem
for (const task of existing.tasks.filter(t => t.taskType === 'group_climate')) {
  const items = await prisma.taskEquipmentItem.findMany({
    where: { taskId: task.id },
    include: { objectEquipment: true },
  });
  for (const item of items) {
    if (!item.objectEquipment?.serialNumber) continue;
    const matchedRequest = await prisma.importedRequest.findFirst({
      where: {
        matchedAddressId: existing.addressId,
        equipmentTypeCode: item.objectEquipment.equipmentTypeCode,
        serialNumber: item.objectEquipment.serialNumber,
        startDate: { lte: visitDate },
        deadline: { gte: visitDate },
        visitRequests: { none: {} },
        ...(existing.contractId ? { contractId: existing.contractId } : {}),
      },
    });
    if (matchedRequest) {
      await prisma.visitRequest.create({
        data: { visitId: existing.id, importedRequestId: matchedRequest.id },
      });
      await prisma.importedRequest.update({
        where: { id: matchedRequest.id },
        data: { visitId: existing.id },
      });
    }
  }
}
```

---

### СП-4. API редактирования serialNumber

**Файл:** `server/src/routes/requests.ts`

#### СП-4.1. Endpoint

```typescript
// PATCH /api/requests/:id
const updateSerialNumberSchema = z.object({
  serialNumber: z.string().trim().max(200).nullable(),
});

router.patch('/:id', validate(updateSerialNumberSchema), async (req: AuthRequest, res: Response) => {
  if (!['admin', 'tm'].includes(req.userRole!)) {
    res.status(403).json({ error: 'Доступно только ТМ и администратору' });
    return;
  }

  const request = await prisma.importedRequest.findUnique({
    where: { id: req.params.id as string },
    include: { equipmentType: true },
  });
  if (!request) { res.status(404).json({ error: 'Заявка не найдена' }); return; }
  if (request.equipmentType?.code === 'iszh_object') {
    res.status(400).json({ error: 'Для заявок ИСЖ объекта серийный номер не используется' });
    return;
  }

  const newSN = req.body.serialNumber;

  // Обновить serialNumber
  await prisma.importedRequest.update({
    where: { id: request.id },
    data: { serialNumber: newSN },
  });

  // Пересчёт привязок (алгоритм из ТЗ раздел 6.2)
  let bound = false;
  if (newSN) {
    // 1. Разорвать текущую связь
    await prisma.visitRequest.deleteMany({ where: { importedRequestId: request.id } });

    // 2. Поискать визит
    const matchingVisit = await findMatchingVisit(
      request.matchedAddressId!,
      request.contractId,
      request.equipmentTypeCode!,
      newSN,
      request.startDate!,
      request.deadline!,
    );

    if (matchingVisit) {
      // 3. Создать новую связь
      await prisma.visitRequest.create({
        data: { visitId: matchingVisit.id, importedRequestId: request.id },
      });
      await prisma.importedRequest.update({
        where: { id: request.id },
        data: { visitId: matchingVisit.id },
      });
      bound = true;
    } else {
      // 4. Вернуть на виртуальный визит (переиспользовать существующий или создать новый)
      let virtualVisitId: string;
      if (!request.visitId) {
        // visitId = null (после миграции или если не был создан) — создаём новый виртуальный визит
        const virtualVisit = await prisma.visit.create({
          data: {
            addressId: request.matchedAddressId!,
            contractId: request.contractId,
            engineerName: '',
            userId: null,
            dateStart: new Date(),
            timeStart: '09:00',
            season: getCurrentSeason(),
            status: 'awaiting_assignment',
          },
        });
        virtualVisitId = virtualVisit.id;
      } else {
        const currentVisit = await prisma.visit.findUnique({
          where: { id: request.visitId },
        });
        if (currentVisit && currentVisit.status === 'awaiting_assignment' && !currentVisit.userId) {
          // Текущий визит уже виртуальный — переиспользуем
          virtualVisitId = currentVisit.id;
        } else {
          // Создаём новый виртуальный визит
          const virtualVisit = await prisma.visit.create({
            data: {
              addressId: request.matchedAddressId!,
              contractId: request.contractId,
              engineerName: '',
              userId: null,
              dateStart: new Date(),
              timeStart: '09:00',
              season: getCurrentSeason(),
              status: 'awaiting_assignment',
            },
          });
          virtualVisitId = virtualVisit.id;
        }
      }
      await prisma.importedRequest.update({
        where: { id: request.id },
        data: { visitId: virtualVisitId },
      });
    }
  }

  // Логирование
  await prisma.requestAssignmentLog.create({
    data: {
      importedRequestId: request.id,
      action: bound ? 'assigned' : 'unassigned',
      performedBy: req.userId,
      reason: `Изменён serialNumber: ${newSN || '(пусто)'}`,
    },
  });

  res.json({ success: true, bound, serialNumber: newSN });
});
```

---

### СП-5. Миграция данных

#### СП-5.1. SQL-скрипт

**Файл:** `server/scripts/migrate-serial-number-bindings.sql`

```sql
-- 0. БЭКАП
CREATE TABLE imported_requests_backup_14102026 AS SELECT * FROM imported_requests;
CREATE TABLE visit_requests_backup_14102026 AS SELECT * FROM visit_requests;

-- 1. Разорвать VisitRequest для не-ИСЖ заявок
DELETE FROM visit_requests
WHERE imported_request_id IN (
  SELECT id FROM imported_requests
  WHERE equipment_type_code != 'iszh_object'
  OR equipment_type_code IS NULL
);

-- 2. Очистить visitId для не-ИСЖ заявок (статус → «Не назначена»)
-- computeExecutionStatus обрабатывает visitId = NULL как not_assigned
UPDATE imported_requests
SET visit_id = NULL
WHERE (equipment_type_code != 'iszh_object' OR equipment_type_code IS NULL)
AND visit_id IS NOT NULL;
```

#### СП-5.2. TypeScript-скрипт пересчёта

**Файл:** `server/scripts/recalculate-request-bindings.ts`

```typescript
// Для каждой не-ИСЖ заявки с serialNumber != null:
// 1. findMatchingVisit(...)
// 2. Если найден — VisitRequest.create + importedRequest.update
// 3. Логировать: { requestId, externalRequestId, visitId, bound: true/false }
```

---

### СП-6. UI — страница заявок

**Файл:** `client/src/pages/RequestsPage.tsx`

#### СП-6.1. Колонка «Серийный №»

Добавить в таблицу (десктоп) после колонки «Оборудование»:

```typescript
{
  title: 'Серийный №',
  dataIndex: 'serialNumber',
  width: 140,
  render: (sn: string | null, record: any) => {
    if (record.equipmentType?.code === 'iszh_object') return <span style={{ color: '#999' }}>—</span>;
    if (!sn) return <span style={{ color: '#ff4d4f' }}>не указан</span>;
    return sn;
  },
}
```

#### СП-6.2. Мобильная карточка

Добавить строку «Серийный №» после «Оборудование»:
```tsx
{req.serialNumber && (
  <div className="card-row">
    <span className="label">Серийный №:</span>
    <span>{req.serialNumber}</span>
  </div>
)}
{!req.serialNumber && req.equipmentType?.code !== 'iszh_object' && (
  <div className="card-row">
    <span className="label">Серийный №:</span>
    <span style={{ color: '#ff4d4f' }}>не указан</span>
  </div>
)}
```

#### СП-6.3. Редактирование serialNumber

В expandable row или модальном окне — поле ввода для не-ИСЖ заявок:
```tsx
{req.equipmentType?.code !== 'iszh_object' && (
  <Input
    placeholder="Серийный номер"
    value={editSN}
    onChange={e => setEditSN(e.target.value)}
    onBlur={() => handleUpdateSN(req.id, editSN)}
  />
)}
```

---

### СП-7. Отчёты

#### СП-7.1. PDF-отчёт по заявкам

**Файл:** `server/src/services/requestsReport.ts`

В детализации задач — добавить строку «Серийный номер»:
```typescript
serialNumber: task.serialNumber || task.objectEquipment?.serialNumber || 'не указан',
```

---

### СП-8. Вычисление статуса заявки

**Файл:** `server/src/routes/requests.ts`

#### СП-8.1. Обновление `computeExecutionStatus`

**Текущая логика** (строки ~14-28): для не-ИСЖ заявок проверяет `visit.tasks.some(t => t.equipmentTypeId === equipmentTypeId)`.

**Проблема:** не проверяет совпадение serialNumber. Заявка может иметь статус «Завершена», хотя задача по конкретному SN не выполнена.

**Изменение:** для не-ИСЖ заявок с serialNumber — добавить проверку совпадения serialNumber:

```typescript
function computeExecutionStatus(visit: any, isISZH: boolean, equipmentTypeId?: string, requestSerialNumber?: string | null): string {
  if (!visit || visit.status === 'awaiting_assignment') return 'not_assigned';
  if (visit.status === 'planned') return 'assigned';
  if (visit.status === 'in_progress') return 'in_progress';
  if (['completed', 'sent', 'corrected_by_tm'].includes(visit.status)) {
    if (equipmentTypeId && visit.tasks && !isISZH) {
      // Проверка: есть ли задача по типу оборудования заявки
      const hasMatchingTask = visit.tasks.some((t: any) => t.equipmentTypeId === equipmentTypeId);
      if (!hasMatchingTask) return 'not_assigned';

      // Дополнительная проверка serialNumber для не-ИСЖ заявок
      if (requestSerialNumber) {
        const hasMatchingSN = visit.tasks.some((t: any) => {
          if (t.equipmentTypeId !== equipmentTypeId) return false;
          const taskSN = t.serialNumber || t.objectEquipment?.serialNumber;
          return taskSN === requestSerialNumber;
        });
        if (!hasMatchingSN) return 'not_assigned';
      }
    }
    return 'completed';
  }
  return 'not_assigned';
}
```

**Вызов:** обновить все вызовы `computeExecutionStatus` — передать `request.serialNumber`:
```typescript
// В GET /api/requests (строка ~360):
executionStatus = computeExecutionStatus(req.visit, false, req.equipmentTypeId, req.serialNumber);

// В reports.ts — аналогично
```

---

## Часть 2. Декомпозиция

| # | Задача | Файлы | Сложность | Зависимости |
|---|---|---|---|---|
| **Этап 1: Модель данных** | | | | |
| 1.1 | Добавить `serialNumber` в Prisma schema | `schema.prisma` | 5 мин | — |
| 1.2 | Создать миграцию | `prisma/migrations/` | 5 мин | 1.1 |
| 1.3 | Обновить `shared/types` | `shared/types/index.ts` | 5 мин | — |
| **Этап 2: Импорт заявок** | | | | |
| 2.1 | Добавить `serialNumber` в `RequestRow` и `ParsedRequest` | `requestImport.ts` | 10 мин | 1.1 |
| 2.2 | Парсинг колонки «Серийный №» в Excel | `requestImport.ts` | 15 мин | 2.1 |
| 2.3 | Нормализация (trim) и сохранение | `requestImport.ts` | 10 мин | 2.2 |
| 2.4 | Валидация дубликатов в файле | `requestImport.ts` | 30 мин | 2.3 |
| 2.5 | Валидация дубликатов в БД (по периоду) | `requestImport.ts` | 30 мин | 2.3 |
| 2.6 | Вынести `findMatchingVisit` в utils | `server/src/utils/requestBinding.ts` | 30 мин | 1.1 |
| 2.7 | Автопривязка при импорте | `requestImport.ts` | 30 мин | 2.6 |
| **Этап 3: Автопривязка в визитах** | | | | |
| 3.1 | ~~Обновить создание визита~~ — НЕ ТРЕБУЕТСЯ (задачи ещё не добавлены) | — | — | — |
| 3.2 | Обновить добавление задачи — поиск по serialNumber | `visits.ts` | 45 мин | 2.6 |
| 3.3 | Обновить group_climate — перебор TaskEquipmentItem | `visits.ts` | 30 мин | 3.2 |
| 3.4 | Обновить завершение визита — поиск по serialNumber | `visits.ts` | 30 мин | 2.6 |
| **Этап 4: API редактирования** | | | | |
| 4.1 | PATCH `/api/requests/:id` — обновление serialNumber | `requests.ts` | 45 мин | 2.6 |
| 4.2 | Пересчёт привязок при изменении serialNumber | `requests.ts` | 30 мин | 4.1 |
| **Этап 5: Миграция данных** | | | | |
| 5.1 | SQL-скрипт разрыва связей | `scripts/migrate-serial-number-bindings.sql` | 15 мин | 1.2 |
| 5.2 | TS-скрипт пересчёта привязок | `scripts/recalculate-request-bindings.ts` | 45 мин | 5.1, 2.6 |
| **Этап 6: UI** | | | | |
| 6.1 | Колонка «Серийный №» в таблице заявок | `RequestsPage.tsx` | 20 мин | 1.3 |
| 6.2 | Мобильная карточка — serialNumber | `RequestsPage.tsx` | 15 мин | 6.1 |
| 6.3 | Редактирование serialNumber (поле ввода + API) | `RequestsPage.tsx` | 45 мин | 4.1 |
| **Этап 7: Отчёты и статусы** | | | | |
| 7.1 | PDF-отчёт — serialNumber в детализации | `requestsReport.ts` | 20 мин | 1.3 |
| 7.2 | Обновить `computeExecutionStatus` — проверка serialNumber | `requests.ts`, `reports.ts` | 30 мин | 1.3 |
| **Этап 8: Тестирование** | | | | |
| 8.1 | Unit-тесты: валидация дубликатов | `requestImport.test.ts` | 30 мин | 2.4, 2.5 |
| 8.2 | Unit-тесты: findMatchingVisit | `requestBinding.test.ts` | 30 мин | 2.6 |
| 8.3 | Интеграционные тесты (сценарии 1–15 из ТЗ) | — | 2 часа | Все этапы |
| 8.4 | Регрессия: ИСЖ-логика | — | 30 мин | Все этапы |

**Итого:** 26 задач (3.1 исключена), ~7.5 часов чистой разработки.

---

## Часть 3. Ревью на соответствие ТЗ

### Проверка покрытия требований ТЗ

| Требование ТЗ | Спецификация | Покрытие |
|---|---|---|
| Раздел 2.1: поле serialNumber в ImportedRequest | СП-1.1, СП-1.2, СП-1.3 | ✅ |
| Раздел 2.2: правила связывания (ИСЖ / не-ИСЖ с SN / не-ИСЖ без SN) | СП-3.1–3.4, СП-2.6 | ✅ |
| Раздел 2.3: условия связи (адрес, договор, период, SN) | СП-3.2 (findMatchingVisit) | ✅ |
| Раздел 2.3: contractId = null → пропуск проверки | СП-3.2 (`...(contractId ? { contractId } : {})`) | ✅ |
| Раздел 2.4: 1 заявка → 1 визит | СП-3.2 (`visitRequests: { none: {} }`) | ✅ |
| Раздел 2.5: group_climate — перебор единиц | СП-3.3 | ✅ |
| Раздел 4.1: парсинг колонки «Серийный №» | СП-2.2 | ✅ |
| Раздел 4.2: trim пробелов | СП-2.3 | ✅ |
| Раздел 4.3: валидация (не-ИСЖ без SN → импорт без привязки) | СП-2.3 | ✅ |
| Раздел 4.4: дубликаты в файле | СП-2.4 | ✅ |
| Раздел 4.4: дубликаты в БД (по периоду) | СП-2.5 | ✅ |
| Раздел 4.6: автопривязка при импорте | СП-2.6, СП-2.7 | ✅ |
| Раздел 5.1: автопривязка при создании визита | СП-3.1 | ✅ Не требуется (задачи ещё не добавлены, привязка работает при добавлении задачи и завершении) |
| Раздел 5.2: автопривязка при добавлении задачи | СП-3.2, СП-3.3 | ✅ |
| Раздел 5.3: автопривязка при завершении | СП-3.4 | ✅ |
| Раздел 6.1: API редактирования serialNumber | СП-4.1 | ✅ |
| Раздел 6.2: алгоритм пересчёта привязок | СП-4.2 | ✅ |
| Раздел 7.1: ИСЖ — без изменений | Все блоки с проверкой `code !== 'iszh_object'` | ✅ |
| Раздел 7.2: разрыв связей не-ИСЖ | СП-5.1 | ✅ |
| Раздел 7.3: скрипт пересчёта | СП-5.2 | ✅ |
| Раздел 8.2: удаление задачи → разрыв связи | Текущая логика (не меняется) | ✅ |
| Раздел 8.3: удаление визита → разрыв связи | Текущая логика (не меняется) | ✅ |
| Раздел 9.1: колонка «Серийный №» в RequestsPage | СП-6.1 | ✅ |
| Раздел 9.1: редактирование serialNumber в UI | СП-6.3 | ✅ |
| Раздел 9.3: PDF-отчёт — serialNumber | СП-7.1 | ✅ |
| Сценарий 11: импорт после завершения визита | СП-2.7 (автопривязка при импорте) | ✅ |
| Сценарий 12–14: дубликаты | СП-2.4, СП-2.5 | ✅ |
| Сценарий 15: contractId = null | СП-3.2 (условный фильтр) | ✅ |

### Проверка исправлений из ревью

| Проблема ревью | Исправление в спецификации | Статус |
|---|---|---|
| Противоречие contractId в коде | СП-3.2: `...(contractId ? { contractId } : {})` — условный фильтр | ✅ Исправлено |
| Дублирование нумерации 7.3 | В ТЗ не исправлено (косметика), в спецификации — корректная нумерация (СП-5.1, СП-5.2) | ⚠️ Косметика в ТЗ |
| Лишний шаг 3 в 7.2 | В СП-5.1 шаг отсутствует | ✅ Исправлено |
| Неявный виртуальный визит при импорте | СП-2.7: если найден визит — привязать, иначе создать виртуальный (текущая логика importRequests) | ✅ Исправлено |

### Выявленные и исправленные пробелы

| # | Пробел | Статус | Исправление |
|---|---|---|---|
| 1 | Автопривязка не-ИСЖ при создании визита не сработает | ✅ **Исправлено** | СП-3.1: убрана, привязка работает при добавлении задачи (СП-3.2) и завершении (СП-3.4) |
| 2 | findMatchingVisit может привязать к виртуальному визиту | ✅ **Исправлено** | Фильтр `status: { not: 'awaiting_assignment' }` уже есть в коде |
| 3 | При пересчёте привязок создаются лишние виртуальные визиты | ✅ **Исправлено** | СП-4.2: переиспользование существующего виртуального визита |
| 4 | `computeExecutionStatus` не проверяет serialNumber | ✅ **Исправлено** | Добавлен СП-8.1 с проверкой SN для не-ИСЖ заявок |

---

## Итого

**Спецификация:** 8 разделов (СП-1–СП-8), покрывает все требования ТЗ.  
**Декомпозиция:** 26 задач (3.1 исключена), ~7.5 часов.  
**Ревью:** все требования ТЗ покрыты, все пробелы исправлены.

**Готово к реализации.**

---

## См. также

- [ТЗ: Привязка заявок по серийному номеру](../tz/serial-number.md) — техническое задание
- [Модель данных](data-model.md) — таблица imported_requests
- [API-контракты](api-contracts.md) — REST API заявок
- [Принятые решения](decisions.md) — раздел 15.34 (модуль заявок)

---
