#!/usr/bin/env python3
"""
Сравнение данных из Excel с базой данных на production-сервере
"""

import json
import paramiko
import sys

# Загрузка данных из Excel
print("=" * 80)
print("ЗАГРУЗКА ДАННЫХ ИЗ EXCEL")
print("=" * 80)

with open("upload/objects.json", "r", encoding="utf-8") as f:
    objects_from_excel = json.load(f)

with open("upload/equipment.json", "r", encoding="utf-8") as f:
    equipment_from_excel = json.load(f)

print(f"\n✓ Объектов из Excel: {len(objects_from_excel)}")
print(f"✓ Оборудования из Excel: {len(equipment_from_excel)}")

# Подключение к production-серверу
print("\n" + "=" * 80)
print("ПОДКЛЮЧЕНИЕ К СЕРВЕРУ")
print("=" * 80)

SERVER = "31.128.38.54"
USERNAME = "root"
KEY_PATH = r"C:\Users\Анна\.ssh\id_ed25519_checklist"

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, username=USERNAME, key_filename=KEY_PATH, timeout=10)
    print(f"\n✓ Подключено к {SERVER}")
except Exception as e:
    print(f"\n✗ Ошибка подключения: {e}")
    sys.exit(1)

# Получение списка объектов из БД
print("\n" + "=" * 80)
print("ПОЛУЧЕНИЕ СПИСКА ОБЪЕКТОВ ИЗ БД")
print("=" * 80)

query_objects = """
docker exec checklist-db-1 psql -U checklist -d checklist -t -A -c "
SELECT object_code, full_address 
FROM addresses 
WHERE is_deleted = false
"
"""

stdin, stdout, stderr = ssh.exec_command(query_objects)
db_objects_raw = stdout.read().decode().strip()
db_objects = {}
for line in db_objects_raw.split('\n'):
    if '|' in line:
        code, address = line.split('|', 1)
        db_objects[code.strip()] = address.strip()

print(f"\n✓ Объектов в БД: {len(db_objects)}")

# Получение списка оборудования из БД
print("\n" + "=" * 80)
print("ПОЛУЧЕНИЕ СПИСКА ОБОРУДОВАНИЯ ИЗ БД")
print("=" * 80)

query_equipment = """
docker exec checklist-db-1 psql -U checklist -d checklist -t -A -c "
SELECT a.object_code, et.name, oe.brand, oe.model, oe.serial_number
FROM object_equipment oe
JOIN addresses a ON oe.address_id = a.id
JOIN equipment_types et ON oe.equipment_type_id = et.id
WHERE a.is_deleted = false
"
"""

stdin, stdout, stderr = ssh.exec_command(query_equipment)
db_equipment_raw = stdout.read().decode().strip()
db_equipment = []
for line in db_equipment_raw.split('\n'):
    if '|' in line:
        parts = line.split('|')
        if len(parts) >= 5:
            db_equipment.append({
                "object_code": parts[0].strip(),
                "equipment_type": parts[1].strip(),
                "brand": parts[2].strip(),
                "model": parts[3].strip(),
                "serial_number": parts[4].strip(),
            })

print(f"\n✓ Оборудования в БД: {len(db_equipment)}")

# Сравнение объектов
print("\n" + "=" * 80)
print("СРАВНЕНИЕ ОБЪЕКТОВ")
print("=" * 80)

excel_object_codes = set(obj["object_code"] for obj in objects_from_excel)
db_object_codes = set(db_objects.keys())

missing_in_db = excel_object_codes - db_object_codes
extra_in_db = db_object_codes - excel_object_codes

print(f"\nОбъектов в Excel: {len(excel_object_codes)}")
print(f"Объектов в БД: {len(db_object_codes)}")
print(f"\nОтсутствуют в БД: {len(missing_in_db)}")
print(f"Есть в БД, но нет в Excel: {len(extra_in_db)}")

if missing_in_db:
    print(f"\n⚠ Объекты для добавления в БД ({len(missing_in_db)}):")
    for code in sorted(list(missing_in_db))[:30]:
        obj = next(o for o in objects_from_excel if o["object_code"] == code)
        print(f"  - {code}: {obj['full_address']}")
    if len(missing_in_db) > 30:
        print(f"  ... и ещё {len(missing_in_db) - 30}")

# Сравнение оборудования
print("\n" + "=" * 80)
print("СРАВНЕНИЕ ОБОРУДОВАНИЯ")
print("=" * 80)

# Создаём ключи для сравнения
def make_key(obj):
    return f"{obj['object_code']}|{obj['equipment_type']}|{obj['brand']}|{obj['model']}|{obj['serial_number']}"

excel_equipment_keys = set(make_key(eq) for eq in equipment_from_excel)
db_equipment_keys = set(make_key(eq) for eq in db_equipment)

missing_equipment = excel_equipment_keys - db_equipment_keys
extra_equipment = db_equipment_keys - excel_equipment_keys

print(f"\nЗаписей оборудования в Excel: {len(excel_equipment_keys)}")
print(f"Записей оборудования в БД: {len(db_equipment_keys)}")
print(f"\nОтсутствуют в БД: {len(missing_equipment)}")
print(f"Есть в БД, но нет в Excel: {len(extra_equipment)}")

# Сохранение результатов
print("\n" + "=" * 80)
print("СОХРАНЕНИЕ РЕЗУЛЬТАТОВ")
print("=" * 80)

results = {
    "objects": {
        "in_excel": len(excel_object_codes),
        "in_db": len(db_object_codes),
        "missing_in_db": sorted(list(missing_in_db)),
        "extra_in_db": sorted(list(extra_in_db)),
    },
    "equipment": {
        "in_excel": len(excel_equipment_keys),
        "in_db": len(db_equipment_keys),
        "missing_in_db_count": len(missing_equipment),
        "extra_in_db_count": len(extra_equipment),
    }
}

with open("upload/comparison-results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"\n✓ Результаты сохранены в upload/comparison-results.json")

ssh.close()

print("\n" + "=" * 80)
print("ГОТОВО!")
print("=" * 80)
