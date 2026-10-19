-- Диагностика проблемы: визит 7144d76e-71d8-4f4b-b782-fb19ff97eefa
-- Проверка связи equipment ↔ room

-- 1. Исходный визит и его задачи
SELECT 
  v.id AS visit_id,
  v.status,
  v.engineer_name,
  v.address_id,
  COUNT(t.id) AS tasks_count
FROM visits v
LEFT JOIN tasks t ON t.visit_id = v.id
WHERE v.id = '7144d76e-71d8-4f4b-b782-fb19ff97eefa'
GROUP BY v.id, v.status, v.engineer_name, v.address_id;

-- 2. Задачи визита с roomType и objectEquipment
SELECT 
  t.id AS task_id,
  t.task_type,
  t.room_type_id,
  t.room_type_code,
  t.object_equipment_id,
  rt.code AS actual_room_code,
  rt.name AS actual_room_name,
  oe.equipment_type_code,
  oe.room_type_code AS equipment_room_code,
  oe.serial_number,
  CASE 
    WHEN t.room_type_code != oe.room_type_code THEN '⚠️ РАСХОЖДЕНИЕ'
    ELSE '✓ OK'
  END AS status
FROM tasks t
LEFT JOIN room_types rt ON rt.id = t.room_type_id
LEFT JOIN object_equipment oe ON oe.id = t.object_equipment_id
WHERE t.visit_id = '7144d76e-71d8-4f4b-b782-fb19ff97eefa'
ORDER BY t.room_type_code, t.task_type;

-- 3. Equipment proposals для этого визита (room_change)
SELECT 
  ep.id,
  ep.request_type,
  ep.status,
  ep.object_equipment_id,
  ep.old_room_type_code,
  ep.room_type_code AS new_room_type_code,
  ep.created_at
FROM equipment_proposals ep
JOIN tasks t ON t.id = ep.task_id
WHERE t.visit_id = '7144d76e-71d8-4f4b-b782-fb19ff97eefa'
  AND ep.request_type = 'room_change'
ORDER BY ep.created_at;

-- 4. ObjectEquipment для этого адреса — проверка roomTypeCode
SELECT 
  oe.id,
  oe.equipment_type_code,
  oe.room_type_code,
  oe.serial_number,
  oe.brand,
  oe.model,
  oe.confirmation_status,
  a.street AS address_street
FROM object_equipment oe
JOIN addresses a ON a.id = oe.address_id
WHERE oe.address_id = (
  SELECT address_id FROM visits WHERE id = '7144d76e-71d8-4f4b-b782-fb19ff97eefa'
)
ORDER BY oe.room_type_code NULLS FIRST, oe.equipment_type_code;

-- 5. Клонированный визит 0f3924b5-e456-4c68-809c-1a156d1e0b18 — проверка задач
SELECT 
  t.id AS task_id,
  t.task_type,
  t.room_type_code,
  t.object_equipment_id,
  oe.room_type_code AS equipment_room_code,
  CASE 
    WHEN t.room_type_code != oe.room_type_code THEN '⚠️ РАСХОЖДЕНИЕ'
    WHEN oe.room_type_code IS NULL THEN '⚠️ У ОБОРУДОВАНИЯ НЕТ ПОМЕЩЕНИЯ'
    ELSE '✓ OK'
  END AS status
FROM tasks t
LEFT JOIN object_equipment oe ON oe.id = t.object_equipment_id
WHERE t.visit_id = '0f3924b5-e456-4c68-809c-1a156d1e0b18'
ORDER BY t.room_type_code NULLS FIRST;
