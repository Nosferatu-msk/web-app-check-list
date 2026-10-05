-- Итоговая статистика привязок октябрьских визитов
SELECT 
  COUNT(*) as total_visits,
  COUNT(DISTINCT CASE WHEN vr.id IS NOT NULL THEN v.id END) as visits_with_requests,
  COUNT(DISTINCT CASE WHEN vr.id IS NULL THEN v.id END) as visits_without_requests
FROM visits v
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false;

-- Проверка: все привязки актуальные (deadline >= visit_date)
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
