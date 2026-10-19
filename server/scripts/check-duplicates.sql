-- Диагностика дубликатов визитов за один день
SELECT 
  DATE(v.date_start) as visit_date,
  v.address_id,
  v.user_id,
  u.full_name as engineer_name,
  COUNT(*) as visit_count,
  ARRAY_AGG(v.id ORDER BY v.created_at) as visit_ids
FROM visits v
JOIN users u ON u.id = v.user_id
WHERE v.is_deleted = false
  AND v.date_start >= '2026-10-01'::timestamp
GROUP BY DATE(v.date_start), v.address_id, v.user_id, u.full_name
HAVING COUNT(*) > 1
ORDER BY visit_date DESC, visit_count DESC
LIMIT 20;
