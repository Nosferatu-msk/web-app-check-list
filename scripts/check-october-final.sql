-- Итоговая статистика связывания октябрьских визитов
SELECT 
  COUNT(*) as total_visits,
  COUNT(DISTINCT CASE WHEN vr.id IS NOT NULL THEN v.id END) as visits_with_requests,
  COUNT(DISTINCT CASE WHEN vr.id IS NULL THEN v.id END) as visits_without_requests
FROM visits v
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false;

-- Детализация: визиты без привязок
SELECT 
  v.id,
  v.date_start,
  a.object_code,
  a.full_address
FROM visits v
JOIN addresses a ON a.id = v.address_id
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
  AND vr.id IS NULL
ORDER BY v.date_start
LIMIT 10;
