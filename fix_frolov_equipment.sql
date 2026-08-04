-- Создание EquipmentProposal для оборудования, которое Фролов А.С. уже добавил
-- по объекту RU/77/423, но которое не попало на модерацию

-- Шаг 1: Найти адрес объекта RU/77/423
-- Шаг 2: Найти пользователя Фролова А.С.
-- Шаг 3: Найти визиты этого объекта, где участвовал Фролов
-- Шаг 4: Найти задачи без objectEquipmentId (новое оборудование)
-- Шаг 5: Создать EquipmentProposal для задач без proposals

-- Сначала посмотрим данные
SELECT 
    a.id as address_id,
    a.object_code,
    a.full_address
FROM addresses a
WHERE a.object_code = 'RU/77/423' AND a.is_deleted = false;

SELECT 
    u.id as user_id,
    u.full_name,
    u.email
FROM users u
WHERE u.full_name LIKE '%Фролов%' AND u.role = 'engineer';

-- Найдем визиты Фролова по этому объекту
SELECT 
    v.id as visit_id,
    v.date_start,
    v.status,
    u.full_name as engineer_name
FROM visits v
JOIN addresses a ON v.address_id = a.id
LEFT JOIN users u ON v.user_id = u.id
LEFT JOIN visit_engineers ve ON v.id = ve.visit_id
LEFT JOIN users u2 ON ve.engineer_id = u2.id
WHERE a.object_code = 'RU/77/423' 
  AND a.is_deleted = false
  AND v.is_deleted = false
  AND (v.user_id IN (SELECT id FROM users WHERE full_name LIKE '%Фролов%')
       OR ve.engineer_id IN (SELECT id FROM users WHERE full_name LIKE '%Фролов%'));

-- Найдем задачи без objectEquipmentId (новое оборудование, добавленное вручную)
SELECT 
    t.id as task_id,
    t.visit_id,
    t.equipment_type_id,
    et.code as equipment_type_code,
    et.name as equipment_type_name,
    t.room_type_id,
    rt.code as room_type_code,
    rt.name as room_type_name,
    t.brand,
    t.model,
    t.serial_number,
    t.comment,
    v.date_start as visit_date
FROM tasks t
JOIN visits v ON t.visit_id = v.id
JOIN addresses a ON v.address_id = a.id
JOIN equipment_types et ON t.equipment_type_id = et.id
LEFT JOIN room_types rt ON t.room_type_id = rt.id
WHERE a.object_code = 'RU/77/423'
  AND a.is_deleted = false
  AND v.is_deleted = false
  AND t.object_equipment_id IS NULL
  AND (v.user_id IN (SELECT id FROM users WHERE full_name LIKE '%Фролов%')
       OR v.id IN (
           SELECT visit_id FROM visit_engineers ve
           WHERE ve.engineer_id IN (SELECT id FROM users WHERE full_name LIKE '%Фролов%')
       ))
ORDER BY v.date_start DESC;

-- Проверим, есть ли уже proposals для этих задач
SELECT 
    ep.id,
    ep.address_id,
    ep.equipment_type_code,
    ep.room_type_code,
    ep.brand,
    ep.model,
    ep.serial_number,
    ep.status,
    ep.created_at,
    u.full_name as proposed_by_name
FROM equipment_proposals ep
JOIN addresses a ON ep.address_id = a.id
JOIN users u ON ep.proposed_by_id = u.id
WHERE a.object_code = 'RU/77/423'
  AND u.full_name LIKE '%Фролов%'
ORDER BY ep.created_at DESC;

-- Теперь создадим proposals для задач, которые ещё не имеют proposals
-- Для этого нужно вставить записи в equipment_proposals
-- ВАЖНО: перед выполнением убедитесь, что задачи из предыдущего запроса не имеют соответствующих proposals

-- Вставка proposals для задач без proposals
INSERT INTO equipment_proposals (
    id,
    address_id,
    equipment_type_code,
    room_type_code,
    brand,
    model,
    serial_number,
    location_description,
    proposed_by_id,
    status,
    request_type,
    pending_until,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid() as id,
    a.id as address_id,
    et.code as equipment_type_code,
    COALESCE(rt.code, '') as room_type_code,
    t.brand,
    t.model,
    t.serial_number,
    t.comment as location_description,
    COALESCE(v.user_id, (
        SELECT ve.engineer_id 
        FROM visit_engineers ve 
        WHERE ve.visit_id = v.id 
        LIMIT 1
    )) as proposed_by_id,
    'pending' as status,
    'new_equipment' as request_type,
    NOW() + INTERVAL '30 days' as pending_until,
    NOW() as created_at,
    NOW() as updated_at
FROM tasks t
JOIN visits v ON t.visit_id = v.id
JOIN addresses a ON v.address_id = a.id
JOIN equipment_types et ON t.equipment_type_id = et.id
LEFT JOIN room_types rt ON t.room_type_id = rt.id
WHERE a.object_code = 'RU/77/423'
  AND a.is_deleted = false
  AND v.is_deleted = false
  AND t.object_equipment_id IS NULL
  AND (v.user_id IN (SELECT id FROM users WHERE full_name LIKE '%Фролов%')
       OR v.id IN (
           SELECT visit_id FROM visit_engineers ve
           WHERE ve.engineer_id IN (SELECT id FROM users WHERE full_name LIKE '%Фролов%')
       ))
  -- Исключаем задачи, для которых уже есть proposal с такими же данными
  AND NOT EXISTS (
      SELECT 1 FROM equipment_proposals ep
      WHERE ep.address_id = a.id
        AND ep.equipment_type_code = et.code
        AND ep.proposed_by_id IN (SELECT id FROM users WHERE full_name LIKE '%Фролов%')
        AND (ep.brand = t.brand OR (ep.brand IS NULL AND t.brand IS NULL))
        AND (ep.model = t.model OR (ep.model IS NULL AND t.model IS NULL))
        AND (ep.serial_number = t.serial_number OR (ep.serial_number IS NULL AND t.serial_number IS NULL))
        AND ep.status = 'pending'
  );

-- Проверим результат
SELECT 
    ep.id,
    ep.equipment_type_code,
    ep.room_type_code,
    ep.brand,
    ep.model,
    ep.serial_number,
    ep.status,
    ep.created_at,
    u.full_name as proposed_by_name
FROM equipment_proposals ep
JOIN users u ON ep.proposed_by_id = u.id
JOIN addresses a ON ep.address_id = a.id
WHERE a.object_code = 'RU/77/423'
  AND u.full_name LIKE '%Фролов%'
  AND ep.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY ep.created_at DESC;
