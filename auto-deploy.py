#!/usr/bin/env python3
"""
Автоматический деплой обновлений от 15.09.2026
Использует paramiko для SSH-подключения
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
    stdin, stdout, stderr = ssh.exec_command(command, timeout=300)

    # Читаем вывод
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
    print("=== Автоматический деплой обновлений 15.09.2026 ===\n")

    # Подключение к серверу
    print(f"Подключение к {SERVER}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"Попытка {attempt + 1}/{max_retries}...")
            ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
            print("✓ Подключение установлено\n")
            break
        except Exception as e:
            print(f"✗ Ошибка подключения (попытка {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                print("Ожидание 5 секунд перед повторной попыткой...")
                time.sleep(5)
            else:
                print(f"\n✗ Не удалось подключиться после {max_retries} попыток", file=sys.stderr)
                sys.exit(1)

    # Команды для выполнения (все с cd /opt/checklist)
    commands = [
        ("cd /opt/checklist && git pull origin main", "1. Получение последних изменений"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c \"UPDATE tasks SET room_type_id = (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи') WHERE room_type_id IN (SELECT id FROM room_types WHERE name = 'Комната приёма пищи' AND id != (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи'));\"",
         "2. Обновление задач (ссылки на дубликаты)"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c \"DELETE FROM room_types WHERE name = 'Комната приёма пищи' AND id != (SELECT MIN(id) FROM room_types WHERE name = 'Комната приёма пищи');\"",
         "3. Удаление дубликатов типов помещений"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c \"ALTER TABLE room_types ADD CONSTRAINT room_types_name_key UNIQUE (name);\"",
         "4. Добавление UNIQUE-ограничения на name"),

        ("cd /opt/checklist && docker cp server/scripts/generate-serial-numbers.ts server:/app/scripts/",
         "5. Копирование скрипта генерации serialNumber"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server npx tsx scripts/generate-serial-numbers.ts",
         "6. Генерация serialNumber для существующего оборудования"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml build",
         "7. Сборка контейнеров"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d",
         "8. Перезапуск контейнеров"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy",
         "9. Применение миграций Prisma"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml ps",
         "10. Проверка статуса контейнеров"),
    ]

    success_count = 0
    for command, description in commands:
        if execute_ssh_command(ssh, command, description):
            success_count += 1
        else:
            print(f"\n⚠ Предупреждение: команда '{description}' завершилась с ошибкой")
            print("Продолжаем выполнение следующей команды...")

    print(f"\n{'='*60}")
    print(f"=== Деплой завершён ===")
    print(f"{'='*60}")
    print(f"Успешно выполнено: {success_count}/{len(commands)}")
    print(f"\nСайт: https://checkonout.ru")
    print(f"\nПроверьте логи:")
    print(f"  ssh root@{SERVER}")
    print(f"  cd /opt/checklist")
    print(f"  docker compose -f docker-compose.prod.yml logs -f server")
    print(f"  docker compose -f docker-compose.prod.yml logs -f client")

    ssh.close()

if __name__ == "__main__":
    main()
