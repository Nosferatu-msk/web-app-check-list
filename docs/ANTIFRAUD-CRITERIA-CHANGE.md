# Изменение критериев критических отклонений антифрод-системы

## Дата изменения
04.10.2026

## Изменённые критерии

### 1. pHash (перцептический хэш) — БЕЗ ИЗМЕНЕНИЙ
- **Critical:** Hamming distance ≤ 4 (визуальное сходство > 93%)
- **Warning:** Hamming distance ≤ 10 (визуальное сходство > 84%)

**Логика:**
- Cross-visit: сравнение с фото того же equipmentTypeId из ДРУГИХ визитов
- Same-visit: для индивидуальных задач — сравнение с фото того же moment внутри ТЕКУЩЕГО визита
- Before/After: проверка идентичности фото ДО и ПОСЛЕ в одном визите

### 2. Timestamp — ИЗМЕНЕНО
**Старый критерий:**
- Любое отклонение от окна визита → **critical**

**Новый критерий:**
- Отклонение > 10000 минут (~6.9 дней) → **critical**
- Отклонение ≤ 10000 минут → **warning**

**Обоснование:**
- Небольшие отклонения (несколько часов/дней) могут быть из-за технических проблем (неправильное время на устройстве, задержка синхронизации)
- Критическим считается только значительное отклонение (> 1 неделя), что указывает на систематический фрод

### 3. GPS — БЕЗ ИЗМЕНЕНИЙ
- **Warning:** расстояние > 500 метров от адреса объекта
- **Warning:** GPS-координаты недоступны

### 4. Source (источник фото) — БЕЗ ИЗМЕНЕНИЙ
- **Warning:** фото загружено из галереи, а не снято камерой

---

## Обновлённые файлы

### Код
- `server/src/services/photoVerification.ts`
  - Добавлена константа `TIMESTAMP_CRITICAL_THRESHOLD_MIN = 10000`
  - Функция `checkTimestamp()` возвращает `severity` в зависимости от `differenceMinutes`
  - Создание отклонения учитывает новую `severity`

### Скрипты перепроверки
- `server/scripts/recheck-photo-anomalies.ts` — анализ существующих отклонений
- `server/scripts/update-timestamp-anomalies.ts` — массовое обновление timestamp-отклонений

---

## Результаты перепроверки (04.10.2026)

### Статистика отклонений
```
Всего отклонений: [будет заполнено после запуска]
- pHash совпадения: [будет заполнено]
- Timestamp отклонения: [будет заполнено]
```

### Timestamp отклонения
```
Критические (> 10000 мин): [будет заполнено]
Предупреждения (<= 10000 мин): [будет заполнено]
```

### pHash отклонения
```
Критические: [будет заполнено]
Предупреждения: [будет заполнено]
```

---

## Порядок применения на production

### 1. Копировать скрипты на сервер
```bash
cd /opt/checklist
docker cp server/scripts/recheck-photo-anomalies.ts checklist-server-1:/app/server/scripts/recheck-photo-anomalies.ts
docker cp server/scripts/update-timestamp-anomalies.ts checklist-server-1:/app/server/scripts/update-timestamp-anomalies.ts
```

### 2. Запустить анализ (чтение)
```bash
docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/recheck-photo-anomalies.ts
```

### 3. Запустить обновление (запись)
```bash
docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/update-timestamp-anomalies.ts
```

### 4. Пересобрать и перезапустить сервер
```bash
docker compose -f docker-compose.prod.yml build server
docker compose -f docker-compose.prod.yml up -d server
```

### 5. Проверить логи
```bash
docker compose -f docker-compose.prod.yml logs --tail=50 server
```

---

## Влияние на существующие данные

### До изменений
- Все timestamp-отклонения были `critical`
- Фото со статусом `suspicious` блокировали завершение визита

### После изменений
- Timestamp-отклонения ≤ 10000 минут станут `warning`
- Фото со статусом `warning` НЕ блокируют завершение визита
- Только `critical` отклонения блокируют завершение

### Ожидаемый результат
- Часть визитов, которые ранее блокировались из-за небольших отклонений timestamp, теперь смогут завершаться
- Систематический фрод (отклонения > 1 недели) по-прежнему блокируется

---

## Мониторинг

После применения рекомендуется отслеживать:
1. Количество завершённых визитов (должно увеличиться)
2. Количество `critical` vs `warning` отклонений
3. Жалобы инженеров на блокировку визитов

---

**Автор изменения:** Qwen Code  
**Дата:** 04.10.2026  
**Статус:** Готово к деплою
