-- Проверка визитов октября с привязками
SELECT 
  v.id,
  v.date_start,
  a.object_code,
  COUNT(vr.id) as requests_count
FROM visits v
JOIN addresses a ON a.id = v.address_id
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
GROUP BY v.id, v.date_start, a.object_code
HAVING COUNT(vr.id) > 0
ORDER BY v.date_start
LIMIT 10;
