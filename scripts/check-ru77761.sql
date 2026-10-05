-- Детальная проверка объекта RU/77/761
-- 1. Все заявки для этого объекта
SELECT 
  ir.id,
  ir.external_request_id,
  ir.object_code,
  ir.start_date,
  ir.deadline,
  ir.import_status,
  et.code as equipment_type_code,
  ir.visit_id
FROM imported_requests ir
JOIN equipment_types et ON et.id = ir.equipment_type_id
WHERE ir.object_code = 'RU/77/761'
ORDER BY ir.start_date, ir.external_request_id;

-- 2. Все визиты для этого объекта
SELECT 
  v.id,
  v.date_start,
  v.status,
  a.object_code
FROM visits v
JOIN addresses a ON a.id = v.address_id
WHERE a.object_code = 'RU/77/761'
  AND v.is_deleted = false
ORDER BY v.date_start;

-- 3. Связи визитов с заявками для этого объекта
SELECT 
  v.id as visit_id,
  v.date_start as visit_date,
  v.status,
  ir.external_request_id,
  ir.start_date as request_start,
  ir.deadline as request_deadline
FROM visits v
JOIN addresses a ON a.id = v.address_id
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
LEFT JOIN imported_requests ir ON ir.id = vr.imported_request_id
WHERE a.object_code = 'RU/77/761'
  AND v.is_deleted = false
ORDER BY v.date_start;

-- 4. Проверка: какие заявки попадают в период каждого визита
SELECT 
  v.id as visit_id,
  v.date_start as visit_date,
  v.status,
  ir.id as request_id,
  ir.external_request_id,
  ir.start_date as request_start,
  ir.deadline as request_deadline,
  CASE 
    WHEN vr.id IS NOT NULL THEN 'СВЯЗАНА'
    ELSE 'НЕ СВЯЗАНА'
  END as link_status
FROM visits v
JOIN addresses a ON a.id = v.address_id
CROSS JOIN imported_requests ir
LEFT JOIN visit_requests vr ON vr.visit_id = v.id AND vr.imported_request_id = ir.id
WHERE a.object_code = 'RU/77/761'
  AND v.is_deleted = false
  AND ir.matched_address_id = a.id
  AND ir.start_date <= v.date_start
  AND ir.deadline >= v.date_start
ORDER BY v.date_start, ir.start_date;
