-- Массовая синхронизация данных задач с proposals после редактирования админом
-- Выполнять ТОЛЬКО после бэкапа БД!

-- Шаг 1: Диагностика - сколько задач рассинхронизировано
SELECT 
  'ДИАГНОСТИКА' as section,
  COUNT(*) as total_tasks_with_proposals,
  COUNT(CASE WHEN t.model IS DISTINCT FROM p.model THEN 1 END) as model_mismatch,
  COUNT(CASE WHEN t."serialNumber" IS DISTINCT FROM p."serialNumber" THEN 1 END) as serial_mismatch,
  COUNT(CASE WHEN t.brand IS DISTINCT FROM p.brand THEN 1 END) as brand_mismatch
FROM tasks t
INNER JOIN equipment_proposals p ON p."taskId" = t.id
WHERE p.status = 'approved'
  AND p."requestType" = 'new_equipment';

-- Шаг 2: Обновление всех рассинхронизированных задач
-- Обновляем brand, model, serialNumber из approved proposals в задачи И в parameters (JSONB)
UPDATE tasks
SET 
  brand = p.brand,
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
WHERE p."taskId" = tasks.id
  AND p.status = 'approved'
  AND p."requestType" = 'new_equipment'
  AND (
    tasks.brand IS DISTINCT FROM p.brand 
    OR tasks.model IS DISTINCT FROM p.model 
    OR tasks."serialNumber" IS DISTINCT FROM p."serialNumber"
  );

-- Шаг 3: Проверка результата
SELECT 
  'РЕЗУЛЬТАТ' as section,
  COUNT(*) as total_synced_tasks,
  COUNT(CASE WHEN t.model = p.model AND t."serialNumber" = p."serialNumber" THEN 1 END) as fully_synced
FROM tasks t
INNER JOIN equipment_proposals p ON p."taskId" = t.id
WHERE p.status = 'approved'
  AND p."requestType" = 'new_equipment';
