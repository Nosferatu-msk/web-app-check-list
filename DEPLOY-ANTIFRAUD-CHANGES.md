# 🚀 Деплой изменений антифрод-системы на production

## Подключиться к серверу

```bash
ssh root@31.128.38.54
```

Пароль: `QJC9B1Um!BPa`

---

## Выполнить команды по очереди

### 1. Перейти в директорию проекта
```bash
cd /opt/checklist
```

### 2. Скопировать скрипты в контейнер
```bash
docker cp server/scripts/recheck-photo-anomalies.ts checklist-server-1:/app/server/scripts/recheck-photo-anomalies.ts
docker cp server/scripts/update-timestamp-anomalies.ts checklist-server-1:/app/server/scripts/update-timestamp-anomalies.ts
```

### 3. Запустить анализ (чтение)
```bash
docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/recheck-photo-anomalies.ts
```

**Что покажет:**
- Сколько всего отклонений
- Сколько timestamp-отклонений станут warning (≤ 10000 мин)
- Сколько останутся critical (> 10000 мин)

### 4. Запустить обновление (запись)
```bash
docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/update-timestamp-anomalies.ts
```

**Что сделает:**
- Понизит timestamp-отклонения ≤ 10000 минут до `warning`
- Оставит timestamp-отклонения > 10000 минут как `critical`
- Пересчитает статусы верификации фото

### 5. Пересобрать и перезапустить сервер
```bash
docker compose -f docker-compose.prod.yml build server
docker compose -f docker-compose.prod.yml up -d server
```

### 6. Проверить логи
```bash
docker compose -f docker-compose.prod.yml logs --tail=20 server
```

### 7. Статистика после обновления
```bash
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c "SELECT type, severity, COUNT(*) as count FROM visit_anomalies GROUP BY type, severity ORDER BY type, severity;"
```

---

## ⚡ Или одной командой (копировать целиком)

```bash
cd /opt/checklist && docker cp server/scripts/recheck-photo-anomalies.ts checklist-server-1:/app/server/scripts/recheck-photo-anomalies.ts && docker cp server/scripts/update-timestamp-anomalies.ts checklist-server-1:/app/server/scripts/update-timestamp-anomalies.ts && docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/recheck-photo-anomalies.ts && docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/update-timestamp-anomalies.ts && docker compose -f docker-compose.prod.yml build server && docker compose -f docker-compose.prod.yml up -d server && echo "✅ Готово!"
```

---

## Проверка после деплоя

### 1. Статистика отклонений
```bash
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c "
SELECT type, severity, COUNT(*) as count 
FROM visit_anomalies 
GROUP BY type, severity 
ORDER BY type, severity;
"
```

### 2. Статистика верификации фото
```bash
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c "
SELECT verification_status, COUNT(*) as count 
FROM photos 
GROUP BY verification_status 
ORDER BY verification_status;
"
```

### 3. Проверить логи сервера
```bash
docker compose -f docker-compose.prod.yml logs --tail=50 server
```

---

## Ожидаемый результат

### До изменений
- Все timestamp-отклонения были `critical`
- Фото со статусом `suspicious` блокировали завершение визита

### После изменений
- Timestamp-отклонения ≤ 10000 минут → `warning`
- Timestamp-отклонения > 10000 минут → `critical`
- Фото со статусом `warning` НЕ блокируют завершение визита

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

**Документация:**
- `ANTIFRAUD-CRITERIA-CHANGE.md` — описание изменений
- `RECHECK-ANTIFRAUD-INSTRUCTIONS.md` — полная инструкция
