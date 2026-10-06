-- Миграция: изменение уникальных ограничений для object_equipment
-- Цель: сделать серийный номер глобально уникальным для типа оборудования
-- Дата: 2026-10-06

-- Шаг 1: Удалить старое уникальное ограничение (addressId, equipmentTypeCode, serialNumber)
ALTER TABLE object_equipment 
DROP CONSTRAINT IF EXISTS object_equipment_address_id_equipment_type_code_serial_n_key;

-- Шаг 2: Добавить новое глобальное уникальное ограничение (equipmentTypeCode, serialNumber)
ALTER TABLE object_equipment 
ADD CONSTRAINT object_equipment_equipment_type_code_serial_number_key 
UNIQUE (equipment_type_code, serial_number);

-- Шаг 3: Убедиться, что второе уникальное ограничение осталось без изменений
-- (addressId, equipmentTypeCode, locationDescription) — уже существует, ничего не делаем

-- Проверка результата
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'object_equipment'::regclass
AND contype = 'u'
ORDER BY conname;
