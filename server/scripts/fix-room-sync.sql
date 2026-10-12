-- Исправление рассинхронизации roomTypeCode между approved proposals и ObjectEquipment
-- Проблема: После approve proposals roomTypeCode в ObjectEquipment не был обновлён
-- Решение: Обновить ObjectEquipment.roomTypeCode из proposal.roomTypeCode

-- Диагностика: Показать все рассинхронизации
SELECT 
    ep.id as proposal_id,
    a.object_code,
    ep.room_type_code as proposal_room,
    oe.room_type_code as equipment_room,
    ep.reviewed_at,
    oe.id as object_equipment_id
FROM equipment_proposals ep
JOIN addresses a ON a.id = ep.address_id
JOIN object_equipment oe ON oe.id = ep.object_equipment_id
WHERE ep.request_type = 'room_change' 
  AND ep.status = 'approved' 
  AND ep.room_type_code != oe.room_type_code
ORDER BY ep.reviewed_at DESC;

-- Исправление: Обновить ObjectEquipment.roomTypeCode из proposal
UPDATE object_equipment oe
SET 
    room_type_code = ep.room_type_code,
    updated_at = NOW()
FROM equipment_proposals ep
WHERE oe.id = ep.object_equipment_id
  AND ep.request_type = 'room_change'
  AND ep.status = 'approved'
  AND ep.room_type_code != oe.room_type_code;

-- Проверка результата: Должно быть 0 рассинхронизаций
SELECT COUNT(*) as remaining_mismatches
FROM equipment_proposals ep
JOIN object_equipment oe ON oe.id = ep.object_equipment_id
WHERE ep.request_type = 'room_change' 
  AND ep.status = 'approved' 
  AND ep.room_type_code != oe.room_type_code;
