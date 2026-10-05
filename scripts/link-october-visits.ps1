# Скрипт связывания октябрьских визитов с заявками
# Запуск на Windows (локальная разработка)

Write-Host "=== Скрипт связывания октябрьских визитов с заявками ===" -ForegroundColor Cyan
Write-Host ""

# Проверка, что мы в корне проекта
if (-not (Test-Path "docker-compose.prod.yml")) {
    Write-Host "Ошибка: скрипт должен запускаться из корня проекта" -ForegroundColor Red
    Write-Host "Текущая директория: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "Шаг 1: Проверка подключения к БД..." -ForegroundColor Green
try {
    $result = docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c "SELECT COUNT(*) FROM visits WHERE date_start >= '2026-10-01' AND date_start < '2026-11-01' AND is_deleted = false;"
    Write-Host "✓ БД доступна" -ForegroundColor Green
    Write-Host $result
} catch {
    Write-Host "Ошибка подключения к БД: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Шаг 2: Диагностика визитов октября без привязок..." -ForegroundColor Green

$diagnosisSql = @"
SELECT 
  v.id AS visit_id,
  v.date_start,
  v.status,
  a.full_address,
  a.object_code,
  COUNT(vr.id) AS linked_requests_count
FROM visits v
JOIN addresses a ON a.id = v.address_id
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
WHERE v.date_start >= '2026-10-01' 
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
GROUP BY v.id, v.date_start, v.status, a.full_address, a.object_code
HAVING COUNT(vr.id) = 0
ORDER BY v.date_start;
"@

$diagnosisResult = docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c $diagnosisSql
Write-Host $diagnosisResult

if ($diagnosisResult -match "0 rows") {
    Write-Host ""
    Write-Host "✓ Все визиты октября уже привязаны к заявкам!" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Найдены визиты без привязок. Продолжить связывание?" -ForegroundColor Yellow
$confirmation = Read-Host "Введите 'yes' для продолжения"

if ($confirmation -ne "yes") {
    Write-Host "Отменено пользователем" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Шаг 3: Запуск скрипта связывания..." -ForegroundColor Green

try {
    $scriptResult = docker compose -f docker-compose.prod.yml exec -T server npx tsx scripts/link-october-visits-to-requests.ts
    Write-Host $scriptResult
    Write-Host ""
    Write-Host "✓ Скрипт выполнен успешно" -ForegroundColor Green
} catch {
    Write-Host "Ошибка выполнения скрипта: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Шаг 4: Проверка результата..." -ForegroundColor Green

$checkSql = @"
SELECT 
  v.id,
  v.date_start,
  a.object_code,
  COUNT(vr.id) AS requests_count
FROM visits v
JOIN addresses a ON a.id = v.address_id
LEFT JOIN visit_requests vr ON vr.visit_id = v.id
WHERE v.date_start >= '2026-10-01' 
  AND v.date_start < '2026-11-01'
  AND v.is_deleted = false
GROUP BY v.id, v.date_start, a.object_code
ORDER BY v.date_start;
"@

$checkResult = docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c $checkSql
Write-Host $checkResult

Write-Host ""
Write-Host "=== Готово ===" -ForegroundColor Cyan
Write-Host "Проверьте отчёты ТМ — теперь все визиты октября должны отображаться с заявками" -ForegroundColor Yellow
