-- Скрипт для проверки и удаления дубликатов типов помещений
-- Выполнять на production-базе данных

-- 1. Проверка наличия дубликатов по name
SELECT name, COUNT(*) as count
FROM room_types
GROUP BY name
HAVING COUNT(*) > 1;

-- 2. Просмотр всех записей "Комната приёма пищи"
SELECT id, name, code, created_at
FROM room_types
WHERE name = 'Комната приёма пищи'
ORDER BY created_at;

-- 3. Удаление дубликатов (оставить запись с минимальным id)
-- ВАЖНО: сначала выполнить SELECT-запрос выше, чтобы убедиться в наличии дубликатов

-- Найти задачи, которые ссылаются на дубликаты (которые будут удалены)
SELECT t.id, t.room_type_id, rt.name, rt.code
FROM tasks t
JOIN room_types rt ON t.room_type_id = rt.id
WHERE rt.name = 'Комната приёма пищи'
  AND rt.id != (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи');

-- Обновить задачи, чтобы они ссылались на правильную запись
UPDATE tasks
SET room_type_id = (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи')
WHERE room_type_id IN (
  SELECT id FROM room_types
  WHERE name = 'Комната приёма пищи'
    AND id != (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи')
);

-- Удалить дубликаты
DELETE FROM room_types
WHERE name = 'Комната приёма пищи'
  AND id != (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи');

-- 4. Проверка успешности удаления
SELECT name, COUNT(*) as count
FROM room_types
GROUP BY name
HAVING COUNT(*) > 1;

-- 5. Добавление UNIQUE-ограничения на name (после удаления дубликатов)
ALTER TABLE room_types ADD CONSTRAINT room_types_name_key UNIQUE (name);
