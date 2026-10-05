-- Удаление привязки октябрьского визита к сентябрьской заявке
DELETE FROM visit_requests
WHERE visit_id = 'e9609e61-ce59-400a-ac84-0397c16b587b'
  AND imported_request_id IN (
    SELECT id FROM imported_requests 
    WHERE external_request_id = 'IS0136719695'
  );

-- Обновление imported_requests.visit_id
UPDATE imported_requests
SET visit_id = NULL
WHERE external_request_id = 'IS0136719695';
