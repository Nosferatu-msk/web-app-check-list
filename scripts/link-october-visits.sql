-- Диагностика октябрьских визитов без привязки к заявкам
-- Выполнять на production через: docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist < scripts/link-october-visits.sql

-- 1. Визиты октября, созданные вручную (не через автопривязку)
SELECT 
  v.id AS visit_id,
  v.date_start,
  v.status,
  a.full_address,
  a.object_code,
  COUNT(vr.id) AS linked_requests_count
FROM visits v
JOIN addresses a ON a.id = v.address_id
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
WHERE v.date_start >= '2026-10-01' 
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
GROUP BY v.id, v.date_start, v.status, a.full_address, a.object_code
HAVING COUNT(vr.id) = 0
ORDER BY v.date_start;

-- 2. Заявки октября (imported_requests), которые ещё не привязаны ни к одному визиту
SELECT 
  ir.id AS request_id,
  ir.external_request_id,
  ir.object_code,
  ir.import_status,
  ir.start_date,
  ir.deadline,
  et.code AS equipment_type_code,
  a.full_address
FROM imported_requests ir
JOIN equipment_types et ON et.id = ir.equipment_type_id
LEFT JOIN addresses a ON a.id = ir.matched_address_id
LEFT JOIN visit_requests vr ON vr.imported_request_id = ir.id
WHERE ir.start_date >= '2026-10-01'
  AND ir.start_date < '2026-11-01'
  AND vr.id IS NULL
ORDER BY ir.start_date, ir.object_code;

-- 3. Полная картина: какие визиты октября имеют привязки
SELECT 
  v.id AS visit_id,
  v.date_start,
  v.status,
  a.object_code,
  ir.external_request_id,
  ir.import_status
FROM visits v
JOIN addresses a ON a.id = v.address_id
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
LEFT JOIN imported_requests ir ON ir.id = vr.imported_request_id
WHERE v.date_start >= '2026-10-01' 
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
ORDER BY v.date_start, a.object_code, ir.external_request_id;
