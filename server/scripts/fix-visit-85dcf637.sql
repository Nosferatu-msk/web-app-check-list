-- Создание отдельных записей оборудования для каждого помещения
-- Визит: 85dcf637-750a-4665-b971-a2d0fefe85b3
-- Объект: RU/77/617

-- Шаг 1: Создать новые записи оборудования для каждой уникальной комбинации brand/model/room
-- Используем UUID в serial_number для обеспечения уникальности
INSERT INTO object_equipment (id, address_id, equipment_type_code, room_type_code, brand, model, serial_number, confirmation_status, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    (SELECT address_id FROM visits WHERE id = '85dcf637-750a-4665-b971-a2d0fefe85b3'),
    'splitvn',
    room_type_code,
    brand,
    model,
    'FIX-85dcf637-' || room_type_code || '-' || gen_random_uuid()::text,
    'confirmed',
    NOW(),
    NOW()
FROM (
    SELECT DISTINCT brand, model, room_type_code
    FROM equipment_proposals 
    WHERE task_id IN (SELECT id FROM tasks WHERE visit_id = '85dcf637-750a-4665-b971-a2d0fefe85b3')
    AND serial_number = 'RU/77/617/splitvn/1'
    AND room_type_code IS NOT NULL
) AS unique_combinations;

-- Шаг 2: Привязать задачи к новому оборудованию
UPDATE tasks t
SET object_equipment_id = oe.id
FROM object_equipment oe
WHERE t.visit_id = '85dcf637-750a-4665-b971-a2d0fefe85b3'
AND t.serial_number = 'RU/77/617/splitvn/1'
AND t.object_equipment_id IS NULL
AND oe.address_id = (SELECT address_id FROM visits WHERE id = '85dcf637-750a-4665-b971-a2d0fefe85b3')
AND oe.equipment_type_code = 'splitvn'
AND oe.room_type_code = t.room_type_code
AND oe.brand = t.brand
AND oe.model = t.model;

-- Шаг 3: Проверить результат
SELECT t.id, t.room_type_code, t.brand, t.model, t.object_equipment_id, oe.serial_number, oe.room_type_code
FROM tasks t
LEFT JOIN object_equipment oe ON oe.id = t.object_equipment_id
WHERE t.visit_id = '85dcf637-750a-4665-b971-a2d0fefe85b3'
AND t.serial_number = 'RU/77/617/splitvn/1'
ORDER BY t.room_type_code;
