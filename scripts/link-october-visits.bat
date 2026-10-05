@echo off
chcp 65001 >nul
echo.
echo === Скрипт связывания октябрьских визитов с заявками ===
echo.
echo Этот скрипт:
echo  1. Проверит визиты октября без привязок к заявкам
echo  2. Автоматически свяжет их с заявками по адресу и периоду
echo  3. Обновит contract_id в визитах
echo.

REM Проверка docker-compose
if not exist "docker-compose.prod.yml" (
    echo ОШИБКА: docker-compose.prod.yml не найден
    echo Запустите скрипт из корня проекта
    pause
    exit /b 1
)

echo.
echo Шаг 1: Диагностика...
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c "SELECT COUNT(*) as visits_without_requests FROM (SELECT v.id FROM visits v LEFT JOIN visit_requests vr ON vr.visit_id = v.id WHERE v.date_start >= '2026-10-01' AND v.date_start < '2026-11-01' AND v.is_deleted = false GROUP BY v.id HAVING COUNT(vr.id) = 0) t;"

echo.
echo Шаг 2: Запуск связывания...
docker compose -f docker-compose.prod.yml exec -T server npx tsx scripts/link-october-visits-to-requests.ts

echo.
echo Шаг 3: Проверка результата...
docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c "SELECT v.id, v.date_start, a.object_code, COUNT(vr.id) as requests_count FROM visits v JOIN addresses a ON a.id = v.address_id LEFT JOIN visit_requests vr ON vr.visit_id = v.id WHERE v.date_start >= '2026-10-01' AND v.date_start < '2026-11-01' AND v.is_deleted = false GROUP BY v.id, v.date_start, a.object_code ORDER BY v.date_start LIMIT 10;"

echo.
echo === Готово ===
echo Проверьте отчёты ТМ — теперь все визиты октября должны отображаться с заявками
pause
