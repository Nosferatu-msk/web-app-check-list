#!/usr/bin/env python3
"""
Проверка применения изменений на production
"""

import paramiko
import sys

SERVER = "31.128.38.54"
USER = "root"
PASSWORD = "QJC9B1Um!BPa"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
        print("✓ Подключение установлено\n")
    except Exception as e:
        print(f"✗ Ошибка подключения: {e}", file=sys.stderr)
        sys.exit(1)

    commands = [
        # Проверка версии кода
        "cd /opt/checklist && git log -1 --oneline",

        # Проверка наличия валидации в клиентском коде
        "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T client grep -n 'METER_CODES' /usr/share/nginx/html/assets/index-*.js | head -5",

        # Проверка наличия утилиты serialNumber на сервере
        "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server ls -la /app/dist/utils/serialNumber.js 2>/dev/null || echo 'Файл не найден'",

        # Проверка кода валидации в сервере
        "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server grep -n 'isMeterEquipment' /app/dist/routes/admin.js | head -3",

        # Проверка актуальности клиентского бандла
        "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T client ls -lh /usr/share/nginx/html/assets/index-*.js",
    ]

    for cmd in commands:
        print(f"\n$ {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        if output:
            print(output)
        if error:
            print(f"STDERR: {error}")

    ssh.close()

if __name__ == "__main__":
    main()
