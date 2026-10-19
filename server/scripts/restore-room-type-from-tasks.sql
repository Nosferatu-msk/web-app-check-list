-- Восстановление связи ObjectEquipment.roomTypeCode из существующих задач
-- Дата: 2026-10-19
-- 
-- Проблема: для задач типа group_climate ObjectEquipment.roomTypeCode не синхронизировался
-- из Task.roomTypeCode при создании/обновлении задачи.
--
-- Решение: использовать данные из task_equipment_items и tasks для обновления roomTypeCode

-- ДИАГНОСТИКА: показать, что будет обновлено
SELECT 
    oe.id as equipment_id,
    oe.equipment_type_code,
    oe.serial_number,
    oe.room_type_code as current_room,
    t.room_type_code as new_room,
    a.full_address as address
FROM object_equipment oe
JOIN task_equipment_items tei ON tei.object_equipment_id = oe.id
JOIN tasks t ON t.id = tei.task_id
JOIN addresses a ON a.id = oe.address_id
WHERE t.room_type_code IS NOT NULL 
  AND (oe.room_type_code IS NULL OR oe.room_type_code != t.room_type_code)
ORDER BY a.full_address, oe.equipment_type_code;

-- ОБНОВЛЕНИЕ: синхронизировать roomTypeCode из задач
UPDATE object_equipment
SET room_type_code = subquery.new_room_type_code,
    updated_at = NOW()
FROM (
    SELECT DISTINCT 
        tei.object_equipment_id,
        t.room_type_code as new_room_type_code
    FROM task_equipment_items tei
    JOIN tasks t ON t.id = tei.task_id
    WHERE t.room_type_code IS NOT NULL
) as subquery
WHERE object_equipment.id = subquery.object_equipment_id
  AND (object_equipment.room_type_code IS NULL 
       OR object_equipment.room_type_code != subquery.new_room_type_code);

-- ПРОВЕРКА: показать результат
SELECT 
    COUNT(*) as total_equipment,
    COUNT(room_type_code) as with_room,
    COUNT(*) - COUNT(room_type_code) as without_room
FROM object_equipment
WHERE is_active = true;
