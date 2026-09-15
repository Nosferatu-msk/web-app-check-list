# Деплой обновлений от 15.09.2026
# Выполнять на Windows PowerShell

$server = "31.128.38.54"
$user = "root"
$password = "QJC9B1Um!BPa"

Write-Host "=== Деплой обновлений 15.09.2026 ===" -ForegroundColor Green
Write-Host ""

# Функция для выполнения SSH-команд
function Invoke-SSHCommand {
    param([string]$Command)

    # Используем plink (PuTTY) или ssh
    $sshCommand = "ssh ${user}@${server} `"$Command`""
    Write-Host "Выполнение: $Command" -ForegroundColor Cyan

    # Для автоматизации можно использовать sshpass или plink
    # Временно: выводим команду для ручного выполнения
    Write-Host "Выполните вручную: ssh ${user}@${server}" -ForegroundColor Yellow
    Write-Host "Затем: $Command" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Подключитесь к серверу:" -ForegroundColor Green
Write-Host "ssh ${user}@${server}" -ForegroundColor White
Write-Host "Пароль: $password" -ForegroundColor White
Write-Host ""

Write-Host "Затем выполните команды:" -ForegroundColor Green
Write-Host ""

$commands = @(
    "cd /opt/checklist",
    "git pull origin main",
    "",
    "# SQL-скрипт для удаления дубликатов",
    "docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist << 'EOF'",
    "UPDATE tasks SET room_type_id = (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи') WHERE room_type_id IN (SELECT id FROM room_types WHERE name = 'Комната приёма пищи' AND id != (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи'));",
    "DELETE FROM room_types WHERE name = 'Комната приёма пищи' AND id != (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи');",
    "ALTER TABLE room_types ADD CONSTRAINT room_types_name_key UNIQUE (name);",
    "EOF",
    "",
    "# Генерация serialNumber",
    "docker cp server/scripts/generate-serial-numbers.ts server:/app/scripts/",
    "docker compose -f docker-compose.prod.yml exec -T server npx tsx scripts/generate-serial-numbers.ts",
    "",
    "# Сборка и перезапуск",
    "docker compose -f docker-compose.prod.yml build",
    "docker compose -f docker-compose.prod.yml up -d",
    "docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy",
    "",
    "# Проверка",
    "docker compose -f docker-compose.prod.yml logs -f server"
)

foreach ($cmd in $commands) {
    if ($cmd -eq "") {
        Write-Host ""
    } elseif ($cmd.StartsWith("#")) {
        Write-Host $cmd -ForegroundColor DarkGray
    } else {
        Write-Host $cmd -ForegroundColor White
    }
}

Write-Host ""
Write-Host "=== После деплоя ===" -ForegroundColor Green
Write-Host "Сайт: https://checkonout.ru" -ForegroundColor White
