# Исправление синхронизации данных задачи с proposal после редактирования админом

**Дата:** 13.10.2026  
**Статус:** Исправлено

## Описание проблемы

Когда админ редактирует proposal на добавление нового оборудования и изменяет данные (модель, серийный номер, бренд), эти данные **не синхронизируются с задачей визита**.

### Симптом
- В справочнике "Оборудование объектов" (`object_equipment`) данные корректные — из proposal
- В задаче визита (`tasks`) данные старые — из первоначального proposal от инженера

### Пример инцидента
**Визит:** `10ec1987-e70a-4532-aa6e-e66e36ee3a92`  
**Задача:** `0c09beca-a954-47de-8990-d638cf967f83`

Инженер добавил счётчик учёта ГВС:
- Модель: `Minol АПЗ ARZAMAS15-3-2`
- Серийный номер: `RU/77/277/iszh_object/1`

Админ при модерации исправил:
- Модель: `Minomess ETW`
- Серийный номер: `7454629`

**Результат:**
- ✅ В `object_equipment` записано: модель `Minomess ETW`, SN `7454629`
- ❌ В `tasks` осталось: модель `Minol АПЗ ARZAMAS15-3-2`, SN `RU/77/277/iszh_object/1`

## Корень проблемы

В endpoint `PATCH /api/proposals/:id` (обновление proposal админом) данные синхронизировались только с `object_equipment`, но **не с задачей**:

```typescript
// ❌ БЫЛО (до исправления)
if (req.body.serialNumber !== undefined && req.body.serialNumber !== proposal.serialNumber && proposal.objectEquipmentId) {
  await prisma.objectEquipment.update({
    where: { id: proposal.objectEquipmentId },
    data: { serialNumber: req.body.serialNumber },
  });
}
// Задача НЕ обновлялась!
```

## Решение

### 1. Исправлен серверный код

**Файл:** `server/src/routes/proposals.ts`

Добавлена синхронизация с задачей при обновлении proposal:

```typescript
// ✅ СТАЛО (после исправления)
// Синхронизация с задачей: если у proposal есть taskId — обновить данные в задаче
if (proposal.taskId) {
  const taskUpdateData: any = {};
  if (req.body.brand !== undefined && req.body.brand !== proposal.brand) {
    taskUpdateData.brand = req.body.brand;
  }
  if (req.body.model !== undefined && req.body.model !== proposal.model) {
    taskUpdateData.model = req.body.model;
  }
  if (req.body.serialNumber !== undefined && req.body.serialNumber !== proposal.serialNumber) {
    taskUpdateData.serialNumber = req.body.serialNumber;
  }
  if (Object.keys(taskUpdateData).length > 0) {
    await prisma.task.update({
      where: { id: proposal.taskId },
      data: taskUpdateData,
    });
  }
}
```

### 2. Скрипты для исправления данных

#### Для конкретного визита
```bash
# Выполнить на production-сервере
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist < server/scripts/fix-task-sync-after-proposal-edit.sql
```

#### Для массового исправления всех рассинхронизированных задач
```bash
# ВАЖНО: Сначала сделать бэкап БД!
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist < server/scripts/sync-all-tasks-with-proposals.sql
```

## Как работает система теперь

### Сценарий 1: Инженер добавляет оборудование → Админ подтверждает без изменений
1. Инженер создаёт proposal с данными (brand, model, serialNumber)
2. Предложение отправляется на модерацию
3. Админ подтверждает proposal (approve)
4. При approve:
   - Создаётся `object_equipment` с данными из proposal
   - Задача обновляется данными из proposal (brand, model, serialNumber)
5. ✅ Все данные синхронизированы

### Сценарий 2: Инженер добавляет оборудование → Админ редактирует → Админ подтверждает
1. Инженер создаёт proposal с данными (brand, model, serialNumber)
2. Предложение отправляется на модерацию
3. **Админ редактирует proposal** (меняет model/serialNumber)
4. При редактировании (PATCH):
   - ✅ Обновляется `object_equipment` (если уже создан)
   - ✅ **Обновляется задача** (brand, model, serialNumber) — **ИСПРАВЛЕНО**
5. Админ подтверждает proposal (approve)
6. При approve:
   - Создаётся/обновляется `object_equipment` с данными из proposal
   - Задача обновляется данными из proposal
7. ✅ Все данные синхронизированы

## Проверка

### Компиляция сервера
```bash
cd server
npm run build
```

### Деплой
```bash
# Пересобрать и перезапустить сервер
docker compose -f docker-compose.prod.yml build server
docker compose -f docker-compose.prod.yml up -d server
```

### Диагностика рассинхронизированных задач
```sql
SELECT 
  t.id as task_id,
  t.model as task_model,
  t."serialNumber" as task_serial,
  p.model as proposal_model,
  p."serialNumber" as proposal_serial,
  oe.model as equipment_model,
  oe."serialNumber" as equipment_serial
FROM tasks t
INNER JOIN equipment_proposals p ON p."taskId" = t.id
LEFT JOIN object_equipment oe ON oe.id = p."objectEquipmentId"
WHERE p.status = 'approved'
  AND p."requestType" = 'new_equipment'
  AND (t.model IS DISTINCT FROM p.model OR t."serialNumber" IS DISTINCT FROM p."serialNumber");
```

## Связанные файлы

- `server/src/routes/proposals.ts` — исправлен endpoint PATCH
- `server/scripts/fix-task-sync-after-proposal-edit.sql` — исправление для конкретного визита
- `server/scripts/sync-all-tasks-with-proposals.sql` — массовое исправление

## Важные замечания

1. **Бэкап перед массовыми операциями!** Всегда делайте бэкап БД перед выполнением массовых UPDATE-скриптов
2. **Приоритет данных:** При approve proposal данные из proposal копируются в задачу и object_equipment — это правильно, т.к. proposal содержит актуальные данные после редактирования
3. **Клиент читает из задачи:** Поля `model` и `serial_number` в форме задачи берутся из `task.model` и `task.serialNumber`, а не из `object_equipment` — поэтому синхронизация задачи критична
