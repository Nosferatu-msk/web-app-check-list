#!/bin/bash
# Скрипт деплоя обновлений от 15.09.2026
# Выполнять на сервере: ssh root@31.128.38.54

set -e

echo "=== Деплой обновлений 15.09.2026 ==="
echo ""

cd /opt/checklist

echo "1. Получение последних изменений..."
git pull origin main

echo ""
echo "2. Выполнение SQL-скрипта для удаления дубликатов типов помещений..."
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist << 'EOF'
-- Проверка наличия дубликатов
SELECT name, COUNT(*) as count FROM room_types GROUP BY name HAVING COUNT(*) > 1;

-- Обновление задач, ссылающихся на дубликаты
UPDATE tasks
SET room_type_id = (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи')
WHERE room_type_id IN (
  SELECT id FROM room_types
  WHERE name = 'Комната приёма пищи'
    AND id != (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи')
);

-- Удаление дубликатов
DELETE FROM room_types
WHERE name = 'Комната приёма пищи'
  AND id != (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи');

-- Добавление UNIQUE-ограничения
ALTER TABLE room_types ADD CONSTRAINT room_types_name_key UNIQUE (name);
EOF

echo ""
echo "3. Копирование скрипта генерации serialNumber..."
docker cp server/scripts/generate-serial-numbers.ts server:/app/scripts/

echo ""
echo "4. Генерация serialNumber для существующего оборудования..."
docker compose -f docker-compose.prod.yml exec -T server npx tsx scripts/generate-serial-numbers.ts

echo ""
echo "5. Сборка и перезапуск контейнеров..."
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "6. Применение миграций Prisma..."
docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy

echo ""
echo "=== Деплой завершён ==="
echo ""
echo "Проверка:"
echo "- docker compose -f docker-compose.prod.yml logs -f server"
echo "- docker compose -f docker-compose.prod.yml logs -f client"
echo ""
echo "Сайт: https://checkonout.ru"
