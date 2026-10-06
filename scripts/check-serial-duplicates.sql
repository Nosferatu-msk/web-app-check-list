-- Диагностика: проверка дубликатов серийных номеров в object_equipment
-- Выполнить ПЕРЕД применением миграции make-serial-number-globally-unique.sql

-- 1. Проверка дубликатов по (equipmentTypeCode, serialNumber)
SELECT 
    equipment_type_code,
    serial_number,
    COUNT(*) as count,
    array_agg(address_id) as address_ids
FROM object_equipment
WHERE serial_number IS NOT NULL
GROUP BY equipment_type_code, serial_number
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 2. Общее количество записей и записей с serial_number
SELECT 
    COUNT(*) as total_records,
    COUNT(serial_number) as with_serial,
    COUNT(*) - COUNT(serial_number) as without_serial
FROM object_equipment;

-- 3. Топ-10 типов оборудования с наибольшим количеством дубликатов
SELECT 
    equipment_type_code,
    COUNT(*) as duplicate_groups,
    SUM(duplicate_count) as total_duplicate_records
FROM (
    SELECT 
        equipment_type_code,
        serial_number,
        COUNT(*) as duplicate_count
    FROM object_equipment
    WHERE serial_number IS NOT NULL
    GROUP BY equipment_type_code, serial_number
    HAVING COUNT(*) > 1
) duplicates
GROUP BY equipment_type_code
ORDER BY total_duplicate_records DESC
LIMIT 10;
