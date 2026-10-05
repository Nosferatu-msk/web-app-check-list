-- Проверка: сколько визитов октября привязаны к заявкам с прошедшим периодом
SELECT 
  v.id as visit_id,
  v.date_start as visit_date,
  ir.external_request_id,
  ir.start_date as request_start,
  ir.deadline as request_deadline,
  a.object_code,
  CASE 
    WHEN ir.deadline < v.date_start THEN 'ПРОШЛАЯ'
    ELSE 'Актуальная'
  END as status
FROM visits v
JOIN addresses a ON a.id = v.address_id
JOIN visit_requests vr ON vr.visit_id = v.id
JOIN imported_requests ir ON ir.id = vr.imported_request_id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
ORDER BY 
  CASE WHEN ir.deadline < v.date_start THEN 0 ELSE 1 END,
  v.date_start;

-- Итоговая статистика
SELECT 
  COUNT(*) as total_links,
  COUNT(CASE WHEN ir.deadline < v.date_start THEN 1 END) as past_requests,
  COUNT(CASE WHEN ir.deadline >= v.date_start THEN 1 END) as actual_requests
FROM visits v
JOIN visit_requests vr ON vr.visit_id = v.id
JOIN imported_requests ir ON ir.id = vr.imported_request_id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false;
