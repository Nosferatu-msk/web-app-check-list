#!/usr/bin/env python3
"""
Принудительная пересборка клиента
"""
import paramiko
import time
import sys

SERVER = "31.128.38.54"
USER = "root"
PASSWORD = "QJC9B1Um!BPa"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

print("Подключение...")
ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
print("✓ Подключено\n")

commands = [
    ("Удаление кэша клиента", "cd /opt/checklist && docker compose -f docker-compose.prod.yml build --no-cache client"),
    ("Перезапуск клиента", "cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d client"),
    ("Ожидание запуска", "sleep 10"),
    ("Проверка статуса", "cd /opt/checklist && docker compose -f docker-compose.prod.yml ps"),
]

for desc, cmd in commands:
    print(f"\n{'='*60}")
    print(f"{desc}")
    print(f"{'='*60}")
    print(f"$ {cmd}")
    
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=1800)
    output = stdout.read().decode('utf-8')
    error = stderr.read().decode('utf-8')
    exit_status = stdout.channel.recv_exit_status()
    
    if output:
        print(output[:2000])
    if error and exit_status != 0:
        print(f"ОШИБКА: {error[:1000]}")
    
    if exit_status != 0:
        print(f"⚠ Код выхода: {exit_status}")

print(f"\n{'='*60}")
print("Готово!")
print(f"{'='*60}")
print("\nСайт: https://checkonout.ru")

ssh.close()
