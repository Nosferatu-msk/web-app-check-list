#!/usr/bin/env python3
import paramiko

SERVER = "31.128.38.54"
USER = "root"
PASSWORD = "QJC9B1Um!BPa"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)

commands = [
    ("git pull", "cd /opt/checklist && git pull origin main"),
    ("build", "cd /opt/checklist && docker compose -f docker-compose.prod.yml build"),
    ("up", "cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d"),
    ("ps", "cd /opt/checklist && docker compose -f docker-compose.prod.yml ps"),
]

for desc, cmd in commands:
    print(f"\n{'='*60}\n{desc}\n{'='*60}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=1800)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    code = stdout.channel.recv_exit_status()
    if out: print(out[:2000])
    if err and code != 0: print(f"ERROR: {err[:1000]}")
    if code != 0: print(f"Exit: {code}")

ssh.close()
print("\n✅ Готово! https://checkonout.ru")
