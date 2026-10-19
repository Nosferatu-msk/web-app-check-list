# План отката: Синхронизация ObjectEquipment.roomTypeCode

## Дата
2026-10-19

## Изменения
- `server/src/routes/visits.ts` — добавлена синхронизация `ObjectEquipment.roomTypeCode` при создании/обновлении задач

## Что может пойти не так
1. **Дубликаты записей** — если оборудование уже имеет `roomTypeCode`, но из другого помещения
2. **Конфликты уникальности** — `@@unique([addressId, equipmentTypeCode, locationDescription])` может конфликтовать
3. **Производительность** — `updateMany` для больших групп оборудования

## План отката

### 1. Откат кода
```bash
# Откатить последний коммит
git revert HEAD

# Задеплоить
cd server && npm run build
pm2 restart checklist-server
```

### 2. Откат данных (если требуется)
```bash
# Восстановить roomTypeCode из бэкапа (если есть)
# Или очистить roomTypeCode у оборудования, которое было создано после деплоя

-- Очистить roomTypeCode у оборудования, созданного после деплоя
UPDATE object_equipment
SET room_type_code = NULL
WHERE created_at > '2026-10-19 12:00:00'
  AND room_type_code IS NOT NULL;
```

### 3. Диагностика проблем
```bash
# Проверить дубликаты equipment по addressId + equipmentTypeCode + locationDescription
SELECT 
  address_id,
  equipment_type_code,
  location_description,
  COUNT(*) as count
FROM object_equipment
WHERE location_description IS NOT NULL
GROUP BY address_id, equipment_type_code, location_description
HAVING COUNT(*) > 1;

# Проверить оборудование с roomTypeCode, но без задач
SELECT 
  oe.id,
  oe.equipment_type_code,
  oe.room_type_code,
  COUNT(t.id) as task_count
FROM object_equipment oe
LEFT JOIN tasks t ON t.object_equipment_id = oe.id
LEFT JOIN task_equipment_items tei ON tei.object_equipment_id = oe.id
WHERE oe.room_type_code IS NOT NULL
  AND t.id IS NULL
  AND tei.id IS NULL
GROUP BY oe.id, oe.equipment_type_code, oe.room_type_code;
```

## Проверка после деплоя

1. Создать тестовый визит
2. Добавить климатическое оборудование (splitvn) через модалку
3. Выбрать помещение
4. Проверить: `SELECT room_type_code FROM object_equipment WHERE id = '<equipment_id>'`
5. Ожидание: `room_type_code` должен совпадать с выбранным помещением

## Ответственный
Анна (владелец проекта)
