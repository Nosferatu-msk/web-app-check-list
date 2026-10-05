-- ПОЛНАЯ ДИАГНОСТИКА привязок октябрьских визитов к заявкам
-- Проверка всех бизнес-правил

-- 1. Визиты октября БЕЗ привязок к заявкам (должны быть только если нет заявок)
SELECT 
  'ВИЗИТЫ БЕЗ ПРИВЯЗОК' as problem_type,
  v.id as visit_id,
  v.date_start,
  v.status,
  a.object_code,
  a.full_address,
  COUNT(ir.id) as available_requests
FROM visits v
JOIN addresses a ON a.id = v.address_id
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
LEFT JOIN imported_requests ir ON ir.matched_address_id = a.id
  AND ir.start_date <= v.date_start
  AND ir.deadline >= v.date_start
  AND ir.equipment_type_id IN (
    SELECT id FROM equipment_types WHERE code = 'iszh_object'
    UNION
    SELECT equipment_type_id FROM tasks t WHERE t.visit_id = v.id
  )
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
  AND vr.id IS NULL
GROUP BY v.id, v.date_start, v.status, a.object_code, a.full_address
HAVING COUNT(ir.id) > 0  -- есть заявки, но визит не привязан
ORDER BY v.date_start;

-- 2. Визиты привязанные к НЕактуальным заявкам (deadline < visit_date)
SELECT 
  'ПРИВЯЗКИ К ПРОШЕДШИМ ЗАЯВКАМ' as problem_type,
  v.id as visit_id,
  v.date_start,
  v.status,
  a.object_code,
  ir.external_request_id,
  ir.start_date,
  ir.deadline
FROM visits v
JOIN addresses a ON a.id = v.address_id
JOIN visit_requests vr ON vr.visit_id = v.id
JOIN imported_requests ir ON ir.id = vr.imported_request_id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
  AND ir.deadline < v.date_start  -- заявка закончилась до визита
ORDER BY v.date_start;

-- 3. Заявки ИСЖ объекта без визитов (визиты должны быть в периоде)
SELECT 
  'ЗАЯВКИ ИСЖ БЕЗ ВИЗИТОВ' as problem_type,
  ir.id as request_id,
  ir.external_request_id,
  ir.object_code,
  ir.start_date,
  ir.deadline,
  ir.import_status,
  COUNT(v.id) as visits_count
FROM imported_requests ir
LEFT JOIN addresses a ON a.id = ir.matched_address_id
LEFT JOIN visit_requests vr ON vr.imported_request_id = ir.id
LEFT JOIN visits v ON v.id = vr.visit_id
  AND v.date_start >= ir.start_date
  AND v.date_start <= ir.deadline
  AND v.is_deleted = false
WHERE ir.start_date >= '2026-10-01'
  AND ir.start_date < '2026-11-01'
  AND ir.equipment_type_id IN (
    SELECT id FROM equipment_types WHERE code = 'iszh_object'
  )
GROUP BY ir.id, ir.external_request_id, ir.object_code, ir.start_date, ir.deadline, ir.import_status
HAVING COUNT(v.id) = 0  -- нет визитов в периоде заявки
ORDER BY ir.start_date;

-- 4. Дубликаты привязок (один визит привязан к нескольким заявкам ИСЖ с одинаковым периодом)
SELECT 
  'ДУБЛИКАТЫ ПРИВЯЗОК ИСЖ' as problem_type,
  v.id as visit_id,
  v.date_start,
  a.object_code,
  COUNT(DISTINCT ir.id) as requests_count,
  STRING_AGG(ir.external_request_id, ', ') as request_ids
FROM visits v
JOIN addresses a ON a.id = v.address_id
JOIN visit_requests vr ON vr.visit_id = v.id
JOIN imported_requests ir ON ir.id = vr.imported_request_id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
  AND ir.equipment_type_id IN (
    SELECT id FROM equipment_types WHERE code = 'iszh_object'
  )
GROUP BY v.id, v.date_start, a.object_code
HAVING COUNT(DISTINCT ir.id) > 1  -- больше одной заявки ИСЖ
ORDER BY v.date_start;

-- 5. Визиты привязанные к заявкам на ДРУГОМ адресе
SELECT 
  'ПРИВЯЗКИ К ДРУГОМУ АДРЕСУ' as problem_type,
  v.id as visit_id,
  v.date_start,
  v.address_id as visit_address_id,
  a1.object_code as visit_object_code,
  ir.id as request_id,
  ir.external_request_id,
  ir.matched_address_id as request_address_id,
  a2.object_code as request_object_code
FROM visits v
JOIN addresses a1 ON a1.id = v.address_id
JOIN visit_requests vr ON vr.visit_id = v.id
JOIN imported_requests ir ON ir.id = vr.imported_request_id
JOIN addresses a2 ON a2.id = ir.matched_address_id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
  AND v.address_id != ir.matched_address_id  -- адреса не совпадают
ORDER BY v.date_start;

-- 6. ИТОГОВАЯ статистика
SELECT 
  'ИТОГО' as summary,
  COUNT(DISTINCT v.id) as total_visits,
  COUNT(DISTINCT CASE WHEN vr.id IS NOT NULL THEN v.id END) as visits_with_requests,
  COUNT(DISTINCT CASE WHEN vr.id IS NULL THEN v.id END) as visits_without_requests,
  COUNT(DISTINCT ir.id) as total_requests,
  COUNT(DISTINCT CASE WHEN vr.id IS NOT NULL THEN ir.id END) as requests_with_visits,
  COUNT(DISTINCT CASE WHEN vr.id IS NULL THEN ir.id END) as requests_without_visits
FROM visits v
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
LEFT JOIN imported_requests ir ON ir.id = vr.imported_request_id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false;
