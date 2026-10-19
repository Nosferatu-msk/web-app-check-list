# Перепроверка отклонений антифрод-системы

## Что изменилось

**Критерии критических отклонений:**
- ✅ **pHash** — без изменений (critical при сходстве > 93%)
- ⚠️ **Timestamp** — изменено: critical только если отклонение > 10000 минут (~6.9 дней)
- ✅ **GPS** — без изменений (warning при отклонении > 500 м)
- ✅ **Source** — без изменений (warning при загрузке из галереи)

---

## Запуск на production

### 1. Подключиться к серверу
```bash
ssh root@31.128.38.54
```

### 2. Перейти в директорию проекта
```bash
cd /opt/checklist
```

### 3. Скопировать скрипты в контейнер
```bash
docker cp server/scripts/recheck-photo-anomalies.ts checklist-server-1:/app/server/scripts/recheck-photo-anomalies.ts
docker cp server/scripts/update-timestamp-anomalies.ts checklist-server-1:/app/server/scripts/update-timestamp-anomalies.ts
```

### 4. Запустить анализ (чтение)
```bash
docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/recheck-photo-anomalies.ts
```

**Что покажет:**
- Сколько всего отклонений
- Сколько timestamp-отклонений станут warning (≤ 10000 мин)
- Сколько останутся critical (> 10000 мин)
- Статистику по pHash отклонениям

### 5. Запустить обновление (запись)
```bash
docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/update-timestamp-anomalies.ts
```

**Что сделает:**
- Понизит timestamp-отклонения ≤ 10000 минут до `warning`
- Оставит timestamp-отклонения > 10000 минут как `critical`
- Пересчитает статусы верификации фото (`suspicious` → `warning` или `clean`)

### 6. Пересобрать и перезапустить сервер
```bash
docker compose -f docker-compose.prod.yml build server
docker compose -f docker-compose.prod.yml up -d server
```

### 7. Проверить логи
```bash
docker compose -f docker-compose.prod.yml logs --tail=50 server
```

---

## Ожидаемый результат

### До изменений
- Все timestamp-отклонения были `critical`
- Фото со статусом `suspicious` блокировали завершение визита

### После изменений
- Timestamp-отклонения ≤ 10000 минут станут `warning`
- Фото со статусом `warning` НЕ блокируют завершение визита
- Только `critical` отклонения блокируют завершение

**Результат:** Часть визитов, которые ранее блокировались из-за небольших отклонений timestamp, теперь смогут завершаться.

---

## Откат (если что-то пошло не так)

```bash
# Откатить изменения кода
cd /opt/checklist
git revert HEAD

# Пересобрать сервер
docker compose -f docker-compose.prod.yml build server
docker compose -f docker-compose.prod.yml up -d server
```

**Важно:** Скрипт обновления отклонений необратим. Для отката данных нужно использовать бэкап БД.

---

## Проверка после применения

```bash
# Проверить количество отклонений по severity
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c "
SELECT type, severity, COUNT(*) as count
FROM visit_anomalies
GROUP BY type, severity
ORDER BY type, severity;
"

# Проверить количество фото по статусу верификации
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c "
SELECT verification_status, COUNT(*) as count
FROM photos
GROUP BY verification_status
ORDER BY verification_status;
"
```

---

**Документация:** `ANTIFRAUD-CRITERIA-CHANGE.md`
