-- Исправление синхронизации данных задачи с proposal после редактирования админом
-- Визит: 10ec1987-e70a-4532-aa6e-e66e36ee3a92
-- Задача: 0c09beca-a954-47de-8990-d638cf967f83
-- Оборудование: Сприбор учета ГВС (счетчик)

-- Шаг 1: Диагностика - просмотр текущих данных
SELECT 
  'ДИАГНОСТИКА' as section,
  t.id as task_id,
  t.brand as task_brand,
  t.model as task_model,
  t."serialNumber" as task_serial,
  p.id as proposal_id,
  p.brand as proposal_brand,
  p.model as proposal_model,
  p."serialNumber" as proposal_serial,
  oe.id as equipment_id,
  oe.brand as equipment_brand,
  oe.model as equipment_model,
  oe."serialNumber" as equipment_serial
FROM tasks t
LEFT JOIN equipment_proposals p ON p."taskId" = t.id
LEFT JOIN object_equipment oe ON oe.id = p."objectEquipmentId"
WHERE t.id = '0c09beca-a954-47de-8990-d638cf967f83';

-- Шаг 2: Обновление данных задачи из proposal (если админ изменил данные перед approve)
-- Обновляем model и serialNumber из proposal в задачу И в parameters (JSONB)
UPDATE tasks
SET 
  model = p.model,
  "serialNumber" = p."serialNumber",
  parameters = jsonb_set(
    jsonb_set(
      parameters, 
      '{model}', 
      to_jsonb(p.model)
    ),
    '{serial_number}', 
    to_jsonb(p."serialNumber")
  ),
  updated_at = NOW()
FROM equipment_proposals p
WHERE tasks.id = '0c09beca-a954-47de-8990-d638cf967f83'
  AND p."taskId" = tasks.id
  AND p.status = 'approved'
  AND (tasks.model IS DISTINCT FROM p.model OR tasks."serialNumber" IS DISTINCT FROM p."serialNumber");

-- Шаг 3: Проверка результата
SELECT 
  'РЕЗУЛЬТАТ' as section,
  t.id as task_id,
  t.brand as task_brand,
  t.model as task_model,
  t."serialNumber" as task_serial,
  oe.model as equipment_model,
  oe."serialNumber" as equipment_serial,
  CASE 
    WHEN t.model = oe.model AND t."serialNumber" = oe."serialNumber" 
    THEN 'СИНХРОНИЗИРОВАНО'
    ELSE 'ТРЕБУЕТ ПРОВЕРКИ'
  END as status
FROM tasks t
LEFT JOIN equipment_proposals p ON p."taskId" = t.id
LEFT JOIN object_equipment oe ON oe.id = p."objectEquipmentId"
WHERE t.id = '0c09beca-a954-47de-8990-d638cf967f83';
