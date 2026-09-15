#!/usr/bin/env python3
import paramiko

SERVER = "31.128.38.54"
USER = "root"
PASSWORD = "QJC9B1Um!BPa"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)

commands = [
    # Проверить коды счётчиков в БД
    "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c \"SELECT code, name FROM equipment_types WHERE code LIKE '%schetchik%' OR code LIKE '%meter%' OR name LIKE '%учет%' ORDER BY code;\"",

    # Проверить дубликаты serialNumber
    "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c \"SELECT address_id, equipment_type_code, serial_number, COUNT(*) as count FROM object_equipment WHERE serial_number IS NOT NULL GROUP BY address_id, equipment_type_code, serial_number HAVING COUNT(*) > 1 LIMIT 10;\"",

    # Проверить примеры serialNumber для splitvn
    "cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c \"SELECT address_id, equipment_type_code, serial_number FROM object_equipment WHERE equipment_type_code = 'splitvn' AND serial_number IS NOT NULL LIMIT 10;\"",
]

for cmd in commands:
    print(f"\n$ {cmd.split(' -c ')[-1][:100]}...")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
    print(stdout.read().decode('utf-8'))

ssh.close()
