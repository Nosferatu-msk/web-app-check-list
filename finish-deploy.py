#!/usr/bin/env python3
"""
Завершение деплоя обновлений от 15.09.2026
"""

import paramiko
import time
import sys

SERVER = "31.128.38.54"
USER = "root"
PASSWORD = "QJC9B1Um!BPa"

def execute_ssh_command(ssh, command, description=""):
    """Выполняет SSH-команду и выводит результат"""
    if description:
        print(f"\n{'='*60}")
        print(f"{description}")
        print(f"{'='*60}")

    print(f"$ {command}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=600)

    output = stdout.read().decode('utf-8')
    error = stderr.read().decode('utf-8')
    exit_status = stdout.channel.recv_exit_status()

    if output:
        print(output)
    if error and exit_status != 0:
        print(f"ОШИБКА: {error}", file=sys.stderr)

    if exit_status != 0:
        print(f"⚠ Команда завершилась с кодом {exit_status}")
        return False

    return True

def main():
    print("=== Завершение деплоя 15.09.2026 ===\n")

    print(f"Подключение к {SERVER}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
        print("✓ Подключение установлено\n")
    except Exception as e:
        print(f"✗ Ошибка подключения: {e}", file=sys.stderr)
        sys.exit(1)

    commands = [
        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml ps",
         "1. Проверка статуса контейнеров"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server mkdir -p /app/scripts",
         "2. Создание директории scripts в контейнере"),

        ("cd /opt/checklist && docker cp server/scripts/generate-serial-numbers.ts server:/app/scripts/",
         "3. Копирование скрипта генерации serialNumber"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server npx tsx scripts/generate-serial-numbers.ts",
         "4. Генерация serialNumber для существующего оборудования"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml restart server",
         "5. Перезапуск сервера"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy",
         "6. Применение миграций Prisma"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml ps",
         "7. Финальная проверка статуса контейнеров"),
    ]

    success_count = 0
    for command, description in commands:
        try:
            if execute_ssh_command(ssh, command, description):
                success_count += 1
            else:
                print(f"\n⚠ Команда '{description}' завершилась с ошибкой")
        except Exception as e:
            print(f"\n✗ Ошибка выполнения команды: {e}")
            print("Попытка переподключения...")
            try:
                ssh.close()
                time.sleep(2)
                ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
                print("✓ Переподключение успешно")
            except:
                print("✗ Не удалось переподключиться")
                break

    print(f"\n{'='*60}")
    print(f"=== Деплой завершён ===")
    print(f"{'='*60}")
    print(f"Успешно выполнено: {success_count}/{len(commands)}")
    print(f"\nСайт: https://checkonout.ru")

    ssh.close()

if __name__ == "__main__":
    main()
