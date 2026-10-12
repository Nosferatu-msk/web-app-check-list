-- Проверка синхронизации roomTypeCode между ObjectEquipment и ПОСЛЕДНИМ approved proposal
-- Используется DISTINCT ON для получения только последнего proposal для каждого оборудования

SELECT 
    ep.object_equipment_id,
    a.object_code,
    ep.room_type_code as last_proposal_room,
    oe.room_type_code as equipment_room,
    ep.reviewed_at as last_reviewed_at
FROM (
    SELECT DISTINCT ON (object_equipment_id) 
        object_equipment_id, 
        room_type_code, 
        reviewed_at,
        address_id
    FROM equipment_proposals 
    WHERE request_type = 'room_change' 
      AND status = 'approved'
    ORDER BY object_equipment_id, reviewed_at DESC
) ep
JOIN addresses a ON a.id = ep.address_id
JOIN object_equipment oe ON oe.id = ep.object_equipment_id
WHERE ep.room_type_code != oe.room_type_code
ORDER BY ep.reviewed_at DESC;

-- Количество рассинхронизаций
SELECT COUNT(*) as mismatch_count
FROM (
    SELECT DISTINCT ON (object_equipment_id) 
        object_equipment_id, 
        room_type_code
    FROM equipment_proposals 
    WHERE request_type = 'room_change' 
      AND status = 'approved'
    ORDER BY object_equipment_id, reviewed_at DESC
) ep
JOIN object_equipment oe ON oe.id = ep.object_equipment_id
WHERE ep.room_type_code != oe.room_type_code;
