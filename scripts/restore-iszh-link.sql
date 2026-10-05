-- Восстановление привязки визита dd151b2c к октябрьской заявке IS0140282788
-- Это правильный визит в периоде действия заявки (05.10.2026 попадает в 01.10-31.10)

-- 1. Создаём связь в visit_requests
INSERT INTO visit_requests (id, visit_id, imported_request_id, created_at)
VALUES (
  gen_random_uuid(),
  'dd151b2c-cdcf-46b5-8a2a-e5fe28a4e316',
  (SELECT id FROM imported_requests WHERE external_request_id = 'IS0140282788'),
  NOW()
);

-- 2. Обновляем imported_requests.visit_id (указываем на первый визит)
UPDATE imported_requests
SET visit_id = 'dd151b2c-cdcf-46b5-8a2a-e5fe28a4e316'
WHERE external_request_id = 'IS0140282788';

-- 3. Проверка результата
SELECT 
  v.id as visit_id,
  v.date_start,
  v.status,
  ir.external_request_id,
  ir.start_date,
  ir.deadline
FROM visits v
JOIN visit_requests vr ON vr.visit_id = v.id
JOIN imported_requests ir ON ir.id = vr.imported_request_id
WHERE v.id IN ('dd151b2c-cdcf-46b5-8a2a-e5fe28a4e316', '1e3efd41-41ae-4fe8-8b07-9649685f2a0b')
ORDER BY v.date_start;
