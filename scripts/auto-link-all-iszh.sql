-- АВТОМАТИЧЕСКОЕ СВЯЗЫВАНИЕ всех визитов октября с заявками ИСЖ объекта
-- Бизнес-правило: одна заявка ИСЖ объекта → много визитов

-- Вставляем связи в visit_requests для всех визитов без привязок
INSERT INTO visit_requests (id, visit_id, imported_request_id, created_at)
SELECT 
  gen_random_uuid(),
  v.id as visit_id,
  ir.id as imported_request_id,
  NOW()
FROM visits v
JOIN addresses a ON a.id = v.address_id
JOIN imported_requests ir ON ir.matched_address_id = a.id
  AND ir.start_date <= v.date_start
  AND ir.deadline >= v.date_start
LEFT JOIN visit_requests vr ON vr.visit_id = v.id AND vr.imported_request_id = ir.id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
  AND vr.id IS NULL  -- только если связь ещё не создана
  AND ir.equipment_type_id IN (
    SELECT id FROM equipment_types WHERE code = 'iszh_object'
  )
ON CONFLICT (visit_id, imported_request_id) DO NOTHING;

-- Обновляем imported_requests.visit_id (указываем на первый визит для каждой заявки)
UPDATE imported_requests ir
SET visit_id = subq.first_visit_id
FROM (
  SELECT 
    ir2.id as request_id,
    MIN(v.id) as first_visit_id
  FROM imported_requests ir2
  JOIN visit_requests vr ON vr.imported_request_id = ir2.id
  JOIN visits v ON v.id = vr.visit_id
  WHERE ir2.start_date >= '2026-10-01'
    AND ir2.start_date < '2026-11-01'
    AND ir2.equipment_type_id IN (
      SELECT id FROM equipment_types WHERE code = 'iszh_object'
    )
  GROUP BY ir2.id
) subq
WHERE ir.id = subq.request_id
  AND ir.visit_id IS DISTINCT FROM subq.first_visit_id;

-- Проверка результата
SELECT 
  COUNT(DISTINCT v.id) as total_visits,
  COUNT(DISTINCT CASE WHEN vr.id IS NOT NULL THEN v.id END) as visits_with_requests,
  COUNT(DISTINCT CASE WHEN vr.id IS NULL THEN v.id END) as visits_without_requests
FROM visits v
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false;
