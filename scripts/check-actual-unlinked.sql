-- Визиты октября БЕЗ привязок (проверка)
SELECT 
  v.id,
  v.date_start,
  v.status,
  a.object_code,
  COUNT(vr.id) as links_count
FROM visits v
JOIN addresses a ON a.id = v.address_id
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
GROUP BY v.id, v.date_start, v.status, a.object_code
HAVING COUNT(vr.id) = 0
ORDER BY v.date_start, a.object_code;

-- Для каждого визита без привязок — проверить доступные заявки
SELECT 
  v.id as visit_id,
  v.date_start,
  v.status,
  a.object_code,
  ir.id as request_id,
  ir.external_request_id,
  ir.start_date,
  ir.deadline,
  et.code as equipment_type_code
FROM visits v
JOIN addresses a ON a.id = v.address_id
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
LEFT JOIN imported_requests ir ON ir.matched_address_id = a.id
  AND ir.start_date <= v.date_start
  AND ir.deadline >= v.date_start
LEFT JOIN equipment_types et ON et.id = ir.equipment_type_id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
  AND vr.id IS NULL  -- визит без привязок
  AND ir.id IS NOT NULL  -- но есть заявки
ORDER BY v.date_start, a.object_code, ir.external_request_id;
