#!/usr/bin/env python3
"""
Пересборка контейнеров с кэшем
"""

import paramiko
import time
import sys

SERVER = "31.128.38.54"
USER = "root"
PASSWORD = "QJC9B1Um!BPa"

def execute_ssh_command(ssh, command, description="", timeout=600):
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
        print(output[:3000] if len(output) > 3000 else output)
    if error and exit_status != 0:
        print(f"ОШИБКА: {error[:1500]}", file=sys.stderr)
    if exit_status != 0:
        print(f"⚠ Команда завершилась с кодом {exit_status}")
        return False
    return True

def main():
    print("=== Пересборка контейнеров ===\n")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
        print("✓ Подключение установлено\n")
    except Exception as e:
        print(f"✗ Ошибка подключения: {e}", file=sys.stderr)
        sys.exit(1)

    commands = [
        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml build",
         "1. Сборка контейнеров (с кэшем)", 1800),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d",
         "2. Перезапуск контейнеров"),

        ("sleep 15 && cd /opt/checklist && docker compose -f docker-compose.prod.yml ps",
         "3. Проверка статуса"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml logs --tail=30 server",
         "4. Логи сервера"),

        ("cd /opt/checklist && docker compose -f docker-compose.prod.yml logs --tail=30 client",
         "5. Логи клиента"),
    ]

    success_count = 0
    for cmd, desc, *timeout_args in commands:
        timeout = timeout_args[0] if timeout_args else 600
        try:
            if execute_ssh_command(ssh, cmd, desc, timeout):
                success_count += 1
        except Exception as e:
            print(f"✗ Ошибка: {e}")
            try:
                ssh.close()
                time.sleep(3)
                ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
            except:
                break

    print(f"\n{'='*60}")
    print(f"Готово! {success_count}/{len(commands)}")
    print(f"{'='*60}")
    print(f"\nСайт: https://checkonout.ru")
    ssh.close()

if __name__ == "__main__":
    main()
