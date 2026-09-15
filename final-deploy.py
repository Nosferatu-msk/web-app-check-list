#!/usr/bin/env python3
"""
Финальный деплой — пересборка и генерация serialNumber
"""

import paramiko
import time
import sys

SERVER = "31.128.38.54"
USER = "root"
PASSWORD = "QJC9B1Um!BPa"

def execute_ssh_command(ssh, command, description="", timeout=600):
    """Выполняет SSH-команду и выводит результат"""
    if description:
        print(f"\n{'='*60}")
        print(f"{description}")
        print(f"{'='*60}")

    print(f"$ {command}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)

    output = stdout.read().decode('utf-8')
    error = stderr.read().decode('utf-8')
    exit_status = stdout.channel.recv_exit_status()

    if output:
        print(output[:2000] if len(output) > 2000 else output)
    if error and exit_status != 0:
        print(f"ОШИБКА: {error[:1000]}", file=sys.stderr)

    if exit_status != 0:
        print(f"⚠ Команда завершилась с кодом {exit_status}")
        return False

    return True

def main():
    print("=== Финальный деплой 15.09.2026 ===\n")

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
        # Проверка наличия файла на сервере
        ("ls -la /opt/checklist/server/scripts/",
         "1. Проверка наличия скриптов на сервере"),

        # Пересборка контейнеров
        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml build --no-cache",
         "2. Пересборка контейнеров (без кэша)"),

        # Перезапуск после сборки
        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d",
         "3. Перезапуск контейнеров"),

        # Ожидание запуска сервера
        ("sleep 10 && cd /opt/checklist && docker compose -f docker-compose.prod.yml ps",
         "4. Ожидание и проверка статуса"),

        # Создание директории в контейнере
        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server mkdir -p /app/scripts",
         "5. Создание директории scripts в контейнере"),

        # Копирование скрипта (используя exec вместо cp)
        ("cd /opt/checklist && cat server/scripts/generate-serial-numbers.ts | docker compose -f docker-compose.prod.yml exec -T server tee /app/scripts/generate-serial-numbers.ts > /dev/null",
         "6. Копирование скрипта через pipe"),

        # Проверка копирования
        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server ls -la /app/scripts/",
         "7. Проверка наличия скрипта в контейнере"),

        # Генерация serialNumber
        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server npx tsx scripts/generate-serial-numbers.ts",
         "8. Генерация serialNumber для существующего оборудования"),

        # Финальная проверка
        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml ps",
         "9. Финальная проверка статуса контейнеров"),

        # Проверка логов
        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml logs --tail=20 server",
         "10. Проверка логов сервера"),
    ]

    success_count = 0
    for i, (command, description) in enumerate(commands, 1):
        try:
            # Для сборки увеличиваем таймаут
            timeout = 1800 if "build" in command else 600
            if execute_ssh_command(ssh, command, description, timeout):
                success_count += 1
            else:
                print(f"\n⚠ Команда '{description}' завершилась с ошибкой")
                if i < 3:  # Если ранняя команда провалилась, продолжаем
                    print("Продолжаем...")
        except Exception as e:
            print(f"\n✗ Ошибка выполнения команды: {e}")
            print("Попытка переподключения...")
            try:
                ssh.close()
                time.sleep(3)
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
    print(f"\nДля проверки логов:")
    print(f"  ssh root@{SERVER}")
    print(f"  cd /opt/checklist")
    print(f"  docker compose -f docker-compose.prod.yml logs -f server")

    ssh.close()

if __name__ == "__main__":
    main()
