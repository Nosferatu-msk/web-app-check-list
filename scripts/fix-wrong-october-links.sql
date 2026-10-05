-- Удаление неправильных привязок октябрьских визитов к августовским заявкам
-- Проверка: визиты октября, привязанные к заявкам с периодом до сентября
SELECT 
  v.id as visit_id,
  v.date_start as visit_date,
  ir.external_request_id,
  ir.start_date as request_start,
  ir.deadline as request_deadline,
  a.object_code
FROM visits v
JOIN addresses a ON a.id = v.address_id
JOIN visit_requests vr ON vr.visit_id = v.id
JOIN imported_requests ir ON ir.id = vr.imported_request_id
WHERE v.date_start >= '2026-10-01'
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
  AND ir.deadline < '2026-09-01'  -- заявки с deadline до сентября
ORDER BY v.date_start;

-- Удаление этих неправильных привязок
DELETE FROM visit_requests
WHERE visit_id IN (
  SELECT v.id
  FROM visits v
  JOIN visit_requests vr ON vr.visit_id = v.id
  JOIN imported_requests ir ON ir.id = vr.imported_request_id
  WHERE v.date_start >= '2026-10-01'
    AND v.date_start < '2026-11-01'
    AND v.is_deleted = false
    AND ir.deadline < '2026-09-01'
);

-- Обновление imported_requests.visit_id для этих случаев
UPDATE imported_requests
SET visit_id = NULL
WHERE id IN (
  SELECT ir.id
  FROM imported_requests ir
  LEFT JOIN visit_requests vr ON vr.imported_request_id = ir.id
  WHERE ir.deadline < '2026-09-01'
    AND vr.id IS NULL
    AND ir.visit_id IS NOT NULL
);
