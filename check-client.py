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
    "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T client ls -la /usr/share/nginx/html/",
    "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T client ls -la /usr/share/nginx/html/assets/ | head -20",
    "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T client find /usr/share/nginx/html -name '*.js' -type f | head -10",
]

for cmd in commands:
    print(f"\n$ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
    print(stdout.read().decode('utf-8'))
    err = stderr.read().decode('utf-8')
    if err:
        print(f"STDERR: {err}")

ssh.close()
