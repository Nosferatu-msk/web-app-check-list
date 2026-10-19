-- Объединение дубликатов визитов за один день
-- Дата: 2026-10-19
-- 
-- Проблема: инженер может создать несколько визитов на один объект в один день
-- Решение: объединить все визиты за один день (по addressId + userId + DATE(dateStart))
-- Оставляем самый старый визит (по createdAt), переносим задачи и фото из остальных

-- ДИАГНОСТИКА: показать дубликаты визитов
SELECT 
    DATE(v.date_start) as visit_date,
    v.address_id,
    v.user_id,
    u.full_name as engineer_name,
    COUNT(*) as visit_count,
    ARRAY_AGG(v.id ORDER BY v.created_at) as visit_ids,
    ARRAY_AGG(v.status ORDER BY v.created_at) as statuses
FROM visits v
JOIN users u ON u.id = v.user_id
WHERE v.is_deleted = false
  AND v.date_start >= '2026-10-01' -- Только октябрьские визиты
GROUP BY DATE(v.date_start), v.address_id, v.user_id, u.full_name
HAVING COUNT(*) > 1
ORDER BY visit_date DESC, visit_count DESC;

-- ДЕТАЛИЗАЦИЯ: показать задачи в дубликатах
SELECT 
    v.id as visit_id,
    v.date_start,
    v.status,
    v.address_id,
    u.full_name as engineer_name,
    COUNT(t.id) as task_count,
    COUNT(DISTINCT t.object_equipment_id) as equipment_count
FROM visits v
JOIN users u ON u.id = v.user_id
LEFT JOIN tasks t ON t.visit_id = v.id
WHERE v.is_deleted = false
  AND v.date_start >= '2026-10-01'
  AND (v.date_start, v.address_id, v.user_id) IN (
    SELECT date_start, address_id, user_id
    FROM visits
    WHERE is_deleted = false AND date_start >= '2026-10-01'
    GROUP BY DATE(date_start), address_id, user_id
    HAVING COUNT(*) > 1
  )
GROUP BY v.id, v.date_start, v.status, v.address_id, u.full_name
ORDER BY v.date_start, v.address_id, v.created_at;
