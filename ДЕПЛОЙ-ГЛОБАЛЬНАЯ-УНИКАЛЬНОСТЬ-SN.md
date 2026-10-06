# Деплой: Глобальная уникальность серийных номеров

## Дата
2026-10-06

## Что изменено

**Бизнес-правило:** Серийный номер теперь уникален для ВСЕГО типа оборудования, а не только в рамках одного объекта.

**Пример:** Прибор учета э/э с серийным номером `123456` не может существовать на двух разных объектах одновременно.

## Изменения в коде

1. **schema.prisma** — изменено уникальное ограничение:
   - Было: `@@unique([addressId, equipmentTypeCode, serialNumber])`
   - Стало: `@@unique([equipmentTypeCode, serialNumber])`

2. **import.ts** — проверка дубликатов при импорте теперь глобальная:
   - Ключ проверки: `SN|${eqTypeCode}|${serialNumber}` (без `addressId`)
   - Добавлен Map для отслеживания серийных номеров по типу оборудования

## Порядок деплоя

### 1. Подключиться к production-серверу
```bash
ssh root@31.128.38.54
cd /home/web-app-check-list
git pull
```

### 2. ПЕРЕД миграцией — проверить дубликаты
```bash
# Выполнить диагностический скрипт
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist < scripts/check-serial-duplicates.sql
```

**Важно:** Если скрипт покажет дубликаты — нужно их удалить или изменить серийные номера ПЕРЕД применением миграции!

### 3. Применить миграцию БД
```bash
# Применить SQL-скрипт для изменения уникальных ограничений
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist < scripts/make-serial-number-globally-unique.sql

# Альтернатива через Prisma (если работает)
docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy
```

### 4. Пересобрать и перезапустить сервер
```bash
docker compose -f docker-compose.prod.yml build server
docker compose -f docker-compose.prod.yml up -d server
```

### 5. Проверить работу
Попробовать импортировать файл `equipment-for-import.xlsx` через админский интерфейс:
- Уникальные записи должны импортироваться
- Дубликаты по serialNumber (даже на разных объектах) — отклоняться

## Возможные проблемы

### Ошибка миграции: "could not create unique constraint"
**Причина:** В БД есть дубликаты по (equipmentTypeCode, serialNumber)

**Решение:**
```sql
-- Найти дубликаты
SELECT equipment_type_code, serial_number, COUNT(*)
FROM object_equipment
WHERE serial_number IS NOT NULL
GROUP BY equipment_type_code, serial_number
HAVING COUNT(*) > 1;

-- Удалить или изменить серийные номера дубликатов
-- Пример: добавить суффикс к serial_number
UPDATE object_equipment
SET serial_number = serial_number || '_dup_' || id::text
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY equipment_type_code, serial_number 
            ORDER BY created_at
        ) as rn
        FROM object_equipment
        WHERE serial_number IS NOT NULL
    ) t WHERE rn > 1
);
```

### Ошибка: "serial_number must be unique across equipment type"
**Причина:** Попытка импортировать запись с serialNumber, который уже существует для этого типа оборудования на другом объекте.

**Решение:** Это корректная работа системы! Серийный номер должен быть уникальным. Нужно либо:
- Изменить serialNumber в импортируемом файле
- Использовать существующую запись (обновить её через UI)

## Откат

Если нужно откатить изменения:
```sql
-- Вернуть старое уникальное ограничение
ALTER TABLE object_equipment 
DROP CONSTRAINT IF EXISTS object_equipment_equipment_type_code_serial_number_key;

ALTER TABLE object_equipment 
ADD CONSTRAINT object_equipment_address_id_equipment_type_code_serial_n_key 
UNIQUE (address_id, equipment_type_code, serial_number);
```

Не забыть откатить код (git revert).
