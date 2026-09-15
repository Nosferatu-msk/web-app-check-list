#!/usr/bin/env python3
import paramiko
import sys

SERVER = "31.128.38.54"
USER = "root"
PASSWORD = "QJC9B1Um!BPa"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)

commands = [
    "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T client grep -o 'schetchik_hvs' /usr/share/nginx/html/assets/index-DtwYXrP7.js | head -3",
    "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T client grep -o 'Серийный номер обязателен' /usr/share/nginx/html/assets/index-DtwYXrP7.js | head -3",
    "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T client grep -o 'Обязательно для счётчиков' /usr/share/nginx/html/assets/index-DtwYXrP7.js | head -3",
    "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T client grep -c 'schetchik_hvs' /usr/share/nginx/html/assets/index-DtwYXrP7.js",
]

for cmd in commands:
    print(f"\n$ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
    output = stdout.read().decode('utf-8').strip()
    print(f"Результат: {output if output else '(не найдено)'}")

ssh.close()
