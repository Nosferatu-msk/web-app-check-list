#!/usr/bin/env python3
"""
Проверка состояния оборудования МБ в БД
"""

import paramiko

SERVER = "31.128.38.54"
USERNAME = "root"
KEY_PATH = r"C:\Users\Анна\.ssh\id_ed25519_checklist"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER, username=USERNAME, key_filename=KEY_PATH, timeout=10)

print("=" * 80)
print("ПРОВЕРКА СОСТОЯНИЯ ОБОРУДОВАНИЯ МБ В БД")
print("=" * 80)

# Общее количество оборудования
query1 = "docker exec checklist-db-1 psql -U checklist -d checklist -c 'SELECT COUNT(*) as total_equipment FROM object_equipment;'"
stdin, stdout, stderr = ssh.exec_command(query1)
print("\nОбщее количество оборудования в БД:")
print(stdout.read().decode())

# Количество оборудования МБ (по кодам объектов)
query2 = """docker exec checklist-db-1 psql -U checklist -d checklist -c "
SELECT COUNT(*) as mb_equipment
FROM object_equipment oe
JOIN addresses a ON oe.address_id = a.id
WHERE a.object_code LIKE 'RU/77/%' OR a.object_code LIKE 'RU/50/%';
"
"""
stdin, stdout, stderr = ssh.exec_command(query2)
print("\nКоличество оборудования МБ в БД:")
print(stdout.read().decode())

# Количество уникальных объектов МБ
query3 = """docker exec checklist-db-1 psql -U checklist -d checklist -c "
SELECT COUNT(DISTINCT a.id) as mb_addresses
FROM addresses a
WHERE a.object_code LIKE 'RU/77/%' OR a.object_code LIKE 'RU/50/%';
"
"""
stdin, stdout, stderr = ssh.exec_command(query3)
print("\nКоличество объектов МБ в БД:")
print(stdout.read().decode())

ssh.close()

print("=" * 80)
print("ГОТОВО!")
print("=" * 80)
