# Запуск перепроверки антифрод-отклонений на production
# Выполнять из PowerShell

$server = "31.128.38.54"
$username = "root"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Перепроверка антифрод-отклонений" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Подключение к серверу
Write-Host "Подключение к $server..." -ForegroundColor Yellow
Write-Host "Команда: ssh $username@$server" -ForegroundColor Gray
Write-Host ""

# Команды для выполнения на сервере
$commands = @(
    "# Перейти в директорию проекта",
    "cd /opt/checklist",
    "",
    "# Скопировать скрипты в контейнер",
    "docker cp server/scripts/recheck-photo-anomalies.ts checklist-server-1:/app/server/scripts/recheck-photo-anomalies.ts",
    "docker cp server/scripts/update-timestamp-anomalies.ts checklist-server-1:/app/server/scripts/update-timestamp-anomalies.ts",
    "",
    "# Запустить анализ (чтение)",
    "docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/recheck-photo-anomalies.ts",
    "",
    "# Запустить обновление (запись)",
    "docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/update-timestamp-anomalies.ts",
    "",
    "# Пересобрать и перезапустить сервер",
    "docker compose -f docker-compose.prod.yml build server",
    "docker compose -f docker-compose.prod.yml up -d server",
    "",
    "# Проверить логи",
    "docker compose -f docker-compose.prod.yml logs --tail=20 server",
    "",
    "# Статистика после обновления",
    'docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c "SELECT type, severity, COUNT(*) as count FROM visit_anomalies GROUP BY type, severity ORDER BY type, severity;"'
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Команды для выполнения на сервере:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($cmd in $commands) {
    if ($cmd -eq "") {
        Write-Host ""
    } elseif ($cmd.StartsWith("#")) {
        Write-Host $cmd -ForegroundColor Green
    } else {
        Write-Host $cmd -ForegroundColor White
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Или одной командой (копировать целиком):" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$oneCommand = @"
cd /opt/checklist && docker cp server/scripts/recheck-photo-anomalies.ts checklist-server-1:/app/server/scripts/recheck-photo-anomalies.ts && docker cp server/scripts/update-timestamp-anomalies.ts checklist-server-1:/app/server/scripts/update-timestamp-anomalies.ts && docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/recheck-photo-anomalies.ts && docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/update-timestamp-anomalies.ts && docker compose -f docker-compose.prod.yml build server && docker compose -f docker-compose.prod.yml up -d server && echo "✅ Готово!"
"@

Write-Host $oneCommand -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Готово к выполнению!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
