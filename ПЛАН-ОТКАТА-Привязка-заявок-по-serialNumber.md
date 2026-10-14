# План отката: Привязка заявок по serialNumber

**Дата:** 14.10.2026  
**Основание:** `Спецификация-Привязка-заявок-по-serialNumber.md`

---

## 1. Что может пойти не так

### Критические риски

| Риск | Вероятность | Влияние | detection |
|---|---|---|---|
| **Миграция БД сломает существующие данные** | Средняя | Критическое | Ошибки при применении миграции |
| **Скрипт разрыва связей удалит не те данные** | Средняя | Критическое | Неправильные связи после миграции |
| **Автопривязка работает некорректно** | Высокая | Среднее | Заявки привязываются к неправильным визитам |
| **computeExecutionStatus даёт неверные статусы** | Средняя | Среднее | Заявки показывают неверный статус |
| **Импорт заявок ломается** | Средняя | Высокое | Ошибки при загрузке Excel-файлов |

### Низкие риски

| Риск | Вероятность | Влияние |
|---|---|---|
| UI не отображает serialNumber | Низкая | Низкое |
| PDF-отчёт без serialNumber | Низкая | Низкое |

---

## 2. Бэкапы перед началом

### 2.1. Бэкап БД (ОБЯЗАТЕЛЬНО)

**Перед миграцией БД (этап 1.2):**

```bash
# На production-сервере
docker exec -t checkonout-db pg_dump -U checklist checklist > backup_before_serial_number_$(date +%Y%m%d_%H%M%S).sql
```

**Проверка бэкапа:**
```bash
# Убедиться, что файл создан и не пустой
ls -lh backup_before_serial_number_*.sql
head -20 backup_before_serial_number_*.sql
```

### 2.2. Бэкап таблиц (перед миграцией данных, этап 5)

```sql
-- Выполнить в psql или через prisma studio
CREATE TABLE imported_requests_backup_before_migration AS 
SELECT * FROM imported_requests;

CREATE TABLE visit_requests_backup_before_migration AS 
SELECT * FROM visit_requests;

-- Проверить количество записей
SELECT COUNT(*) FROM imported_requests_backup_before_migration;
SELECT COUNT(*) FROM visit_requests_backup_before_migration;
```

### 2.3. Git-тег перед началом реализации

```bash
git tag -a v-before-serial-number -m "Точка отката перед реализацией привязки по serialNumber"
git push origin v-before-serial-number
```

---

## 3. План отката по этапам

### Этап 1: Модель данных и миграция

**Что делаем:**
- Добавляем поле `serialNumber` в `ImportedRequest`
- Создаём миграцию БД

**Что может пойти не так:**
- Миграция не применяется (ошибка синтаксиса, конфликты)
- Поле добавляется, но индекс не создаётся

**План отката:**
```bash
# Откат миграции
cd server
npx prisma migrate rollback

# Если не помогло — ручной откат
psql -U checklist -d checklist -c "
ALTER TABLE imported_requests DROP COLUMN IF EXISTS serial_number;
DROP INDEX IF EXISTS imported_requests_serial_number_idx;
"

# Откат кода
git checkout v-before-serial-number -- server/prisma/schema.prisma shared/types/index.ts
npx prisma generate
```

**Критерий успеха отката:**
```sql
-- Проверить, что поле удалено
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'imported_requests' AND column_name = 'serial_number';
-- Должно вернуть 0 строк
```

---

### Этап 2: Импорт заявок

**Что делаем:**
- Добавляем парсинг serialNumber из Excel
- Добавляем валидацию дубликатов
- Добавляем автопривязку при импорте

**Что может пойти не так:**
- Импорт ломается для существующих файлов (без serialNumber)
- Валидация дубликатов блокирует корректные заявки
- Автопривязка привязывает не те заявки

**План отката:**
```bash
# Откат кода
git checkout v-before-serial-number -- server/src/services/requestImport.ts

# Пересборка
cd server && npm run build

# Рестарт сервера
pm2 restart checklist-server
```

**Проверка:**
- Загрузить тестовый Excel-файл (без serialNumber) — должен импортироваться как раньше
- Проверить логи: нет ошибок парсинга

---

### Этап 3: Автопривязка в визитах

**Что делаем:**
- Обновляем добавление задачи — поиск по serialNumber
- Обновляем завершение визита — поиск по serialNumber

**Что может пойти не так:**
- Заявки привязываются к неправильным визитам
- Старые связи (по equipmentTypeId) не работают

**План отката:**
```bash
# Откат кода
git checkout v-before-serial-number -- server/src/routes/visits.ts

# Пересборка и рестарт
cd server && npm run build && pm2 restart checklist-server
```

**Проверка:**
- Создать тестовый визит, добавить задачу — привязка должна работать по старому алгоритму (по equipmentTypeId)

---

### Этап 4: API редактирования serialNumber

**Что делает:**
- PATCH `/api/requests/:id` — обновление serialNumber
- Пересчёт привязок

**Что может пойти не так:**
- API возвращает ошибки
- Пересчёт привязок работает некорректно

**План отката:**
```bash
# Откат кода
git checkout v-before-serial-number -- server/src/routes/requests.ts

# Пересборка и рестарт
cd server && npm run build && pm2 restart checklist-server
```

**Проверка:**
- PATCH-запрос должен возвращать 404 (endpoint не существует)

---

### Этап 5: Миграция данных (КРИТИЧЕСКИЙ ЭТАП)

**Что делаем:**
- Разрываем связи VisitRequest для не-ИСЖ заявок
- Очищаем visitId для не-ИСЖ заявок
- Пересчитываем привязки для заявок с serialNumber

**Что может пойти не так:**
- Скрипт удалит связи для ИСЖ заявок (критическая ошибка!)
- Скрипт удалит не те связи
- Пересчёт привязок работает некорректно

**План отката:**

**Шаг 1: Немедленная остановка**
```bash
# Остановить сервер (чтобы новые заявки не создавались)
pm2 stop checklist-server
```

**Шаг 2: Откат из бэкапа таблиц**
```sql
-- Очистить текущие таблицы
DELETE FROM visit_requests;
DELETE FROM imported_requests;

-- Восстановить из бэкапа
INSERT INTO visit_requests SELECT * FROM visit_requests_backup_before_migration;
INSERT INTO imported_requests SELECT * FROM imported_requests_backup_before_migration;

-- Проверить количество записей
SELECT COUNT(*) FROM visit_requests; -- должно совпадать с бэкапом
SELECT COUNT(*) FROM imported_requests; -- должно совпадать с бэкапом
```

**Шаг 3: Откат кода (если нужно)**
```bash
git checkout v-before-serial-number -- server/scripts/
```

**Шаг 4: Запуск сервера**
```bash
pm2 start checklist-server
```

**Критерий успеха отката:**
```sql
-- Проверить, что связи восстановлены
SELECT COUNT(*) FROM visit_requests;
-- Должно совпадать с backup

-- Проверить случайную не-ИСЖ заявку
SELECT ir.id, ir.externalRequestId, ir.visit_id, vr.visit_id as vr_visit_id
FROM imported_requests ir
LEFT JOIN visit_requests vr ON vr.importedRequestId = ir.id
WHERE ir.equipment_type_code != 'iszh_object'
LIMIT 10;
-- visit_id и vr.visit_id должны совпадать с бэкапом
```

---

### Этап 6: UI

**Что делаем:**
- Добавляем колонку «Серийный №»
- Добавляем редактирование serialNumber

**Что может пойти не так:**
- UI ломается (белый экран)
- Колонка не отображается

**План отката:**
```bash
# Откат кода
git checkout v-before-serial-number -- client/src/pages/RequestsPage.tsx

# Пересборка клиента
cd client && npm run build

# Деплой (если нужно)
# ...
```

**Проверка:**
- Открыть страницу заявок — должна работать как раньше
- Колонка «Серийный №» не отображается

---

### Этап 7: Отчёты и статусы

**Что делаем:**
- Обновляем PDF-отчёт
- Обновляем computeExecutionStatus

**Что может пойти не так:**
- PDF-отчёт ломается
- Статусы заявок неверные

**План отката:**
```bash
# Откат кода
git checkout v-before-serial-number -- server/src/services/requestsReport.ts server/src/routes/requests.ts

# Пересборка и рестарт
cd server && npm run build && pm2 restart checklist-server
```

**Проверка:**
- Сформировать тестовый PDF-отчёт — должен работать как раньше
- Проверить статусы заявок на странице RequestsPage

---

## 4. Полный откат (если ничего не помогает)

**Сценарий:** критическая ошибка, частичные откаты не помогают.

**Порядок действий:**

1. **Остановить сервер:**
```bash
pm2 stop checklist-server
```

2. **Откат БД из бэкапа:**
```bash
# Восстановить из бэкапа
psql -U checklist -d checklist < backup_before_serial_number_YYYYMMDD_HHMMSS.sql
```

3. **Откат кода:**
```bash
git checkout v-before-serial-number
npm install
cd server && npm run build
cd ../client && npm run build
```

4. **Запуск сервера:**
```bash
pm2 start checklist-server
```

5. **Проверка:**
- Все страницы работают
- Импорт заявок работает
- Привязка заявок работает по старому алгоритму
- Статусы заявок корректные

---

## 5. Проверочные скрипты

### 5.1. Проверка целостности данных после миграции

```sql
-- Количество связей до и после должно быть предсказуемым
SELECT 
  COUNT(*) as total_requests,
  COUNT(CASE WHEN equipment_type_code = 'iszh_object' THEN 1 END) as iszh_requests,
  COUNT(CASE WHEN equipment_type_code != 'iszh_object' OR equipment_type_code IS NULL THEN 1 END) as non_iszh_requests
FROM imported_requests;

-- Проверить, что ИСЖ связи не затронуты
SELECT COUNT(*) as iszh_visit_requests
FROM visit_requests vr
JOIN imported_requests ir ON ir.id = vr.importedRequestId
WHERE ir.equipment_type_code = 'iszh_object';
-- Должно совпадать с бэкапом
```

### 5.2. Проверка привязок после пересчёта

```sql
-- Для не-ИСЖ заявок с serialNumber — проверить привязки
SELECT 
  ir.externalRequestId,
  ir.serialNumber,
  ir.equipment_type_code,
  ir.visit_id,
  v.status as visit_status
FROM imported_requests ir
LEFT JOIN visits v ON v.id = ir.visit_id
WHERE ir.serialNumber IS NOT NULL
  AND ir.equipment_type_code != 'iszh_object'
LIMIT 20;
```

---

## 6. Чек-лист перед началом реализации

- [ ] Создан бэкап БД (`backup_before_serial_number_*.sql`)
- [ ] Создан git-тег `v-before-serial-number`
- [ ] Проверена возможность отката миграции (на staging)
- [ ] Подготовлены SQL-скрипты для ручного отката
- [ ] Анна уведомлена о плане отката
- [ ] Определено окно для отката (если что-то пойдёт не так)

---

## 7. Ответственные

| Роль | Имя | Действие |
|---|---|---|
| Разработчик | Qwen Code | Реализация, откат кода |
| Владелец продукта | Анна | Согласование отката, проверка данных |
| DBA | Анна | Бэкап БД, откат БД |

---

## Итого

**Критические точки отката:**
1. Этап 1 (миграция БД) — откат через `prisma migrate rollback`
2. Этап 5 (миграция данных) — откат через восстановление из бэкапа таблиц

**Время отката:**
- Частичный откат (один этап): 5–15 минут
- Полный откат: 30–60 минут

**Готовность к откату:** все этапы имеют план отката, бэкапы создаются автоматически.
