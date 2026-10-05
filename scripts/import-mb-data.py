#!/usr/bin/env python3
"""
Импорт недостающих объектов и оборудования МБ
"""

import json
import paramiko
import sys

print("=" * 80)
print("ИМПОРТ ДАННЫХ МБ")
print("=" * 80)

# Загрузка данных
with open("upload/objects.json", "r", encoding="utf-8") as f:
    objects_from_excel = json.load(f)

with open("upload/equipment.json", "r", encoding="utf-8") as f:
    equipment_from_excel = json.load(f)

# Подключение к серверу
SERVER = "31.128.38.54"
USERNAME = "root"
KEY_PATH = r"C:\Users\Анна\.ssh\id_ed25519_checklist"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER, username=USERNAME, key_filename=KEY_PATH, timeout=10)
print(f"\n✓ Подключено к {SERVER}")

# Получение ID ТМ tm_mb@mb.ru
print("\n" + "=" * 80)
print("ПОЛУЧЕНИЕ ID ТМ tm_mb@mb.ru")
print("=" * 80)

query_tm = """
docker exec checklist-db-1 psql -U checklist -d checklist -t -A -c "
SELECT id FROM users WHERE email = 'tm_mb@mb.ru'
"
"""
stdin, stdout, stderr = ssh.exec_command(query_tm)
tm_id = stdout.read().decode().strip()
print(f"\nTM ID: {tm_id}")

if not tm_id:
    print("✗ ТМ tm_mb@mb.ru не найден!")
    ssh.close()
    sys.exit(1)

# Получение списка объектов из БД
print("\n" + "=" * 80)
print("ПОЛУЧЕНИЕ СПИСКА ОБЪЕКТОВ ИЗ БД")
print("=" * 80)

query_objects = """
docker exec checklist-db-1 psql -U checklist -d checklist -t -A -c "
SELECT object_code FROM addresses WHERE is_deleted = false
"
"""
stdin, stdout, stderr = ssh.exec_command(query_objects)
db_object_codes = set(stdout.read().decode().strip().split('\n'))
print(f"\n✓ Объектов в БД: {len(db_object_codes)}")

# Нахождение недостающих объектов
excel_object_codes = set(obj["object_code"] for obj in objects_from_excel)
missing_objects = excel_object_codes - db_object_codes
print(f"Отсутствуют в БД: {len(missing_objects)}")

if len(missing_objects) > 0:
    print(f"\nПримеры недостающих объектов:")
    for code in list(missing_objects)[:5]:
        obj = next(o for o in objects_from_excel if o["object_code"] == code)
        print(f"  - {code}: {obj.get('full_address')}")

# Шаг 1: Добавление недостающих объектов
print("\n" + "=" * 80)
print("ШАГ 1: ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ ОБЪЕКТОВ")
print("=" * 80)

added_objects = 0
for obj in objects_from_excel:
    code = obj["object_code"]
    if code in missing_objects:
        print(f"\nОбработка объекта: {code}")
        # Вставка объекта
        city = (obj.get("city") or "").replace("'", "''")
        street = (obj.get("street") or "нет").replace("'", "''")
        house = (obj.get("building") or "").replace("'", "''")
        building = (obj.get("building") or "").replace("'", "''")
        full_address = (obj.get("full_address") or "").replace("'", "''")
        object_code = code
        
        insert_query = f"""
        docker exec checklist-db-1 psql -U checklist -d checklist -t -A -c "
        INSERT INTO addresses (id, object_code, city, street, house, building, full_address, is_deleted, updated_at)
        VALUES (gen_random_uuid()::text, '{object_code}', '{city}', '{street}', '{house}', '{building}', '{full_address}', false, NOW())
        RETURNING id
        "
        """
        
        stdin, stdout, stderr = ssh.exec_command(insert_query)
        address_id = stdout.read().decode().strip()
        error_output = stderr.read().decode().strip()
        
        print(f"  Address ID: {address_id}")
        if error_output:
            print(f"  Ошибка: {error_output}")

        if address_id:
            # Связь с ТМ
            link_query = f"""
            docker exec checklist-db-1 psql -U checklist -d checklist -c "
            INSERT INTO tm_objects (tm_id, address_id)
            VALUES ('{tm_id}', '{address_id}')
            "
            """
            ssh.exec_command(link_query)
            added_objects += 1
            print(f"  ✓ Добавлен объект {object_code}: {full_address}")

print(f"\n✓ Добавлено объектов: {added_objects}")

# Шаг 2: Проверка типов оборудования
print("\n" + "=" * 80)
print("ШАГ 2: ПРОВЕРКА ТИПОВ ОБОРУДОВАНИЯ")
print("=" * 80)

query_types = """
docker exec checklist-db-1 psql -U checklist -d checklist -t -A -c "
SELECT code, name FROM equipment_types WHERE is_active = true
"
"""
stdin, stdout, stderr = ssh.exec_command(query_types)
db_types = {}
for line in stdout.read().decode().strip().split('\n'):
    if '|' in line:
        code, name = line.split('|', 1)
        db_types[name.strip()] = code.strip()

print(f"\n✓ Типов оборудования в БД: {len(db_types)}")

# Проверка новых типов
excel_types = set(eq["equipment_type"] for eq in equipment_from_excel)
new_types = excel_types - set(db_types.keys())

if new_types:
    print(f"\n⚠ Новые типы оборудования ({len(new_types)}):")
    for t in list(new_types)[:20]:
        print(f"  - {t}")
    print("\nЭти типы НЕ будут загружены!")
else:
    print("\n✓ Все типы оборудования есть в справочнике")

# Шаг 3: Импорт оборудования
print("\n" + "=" * 80)
print("ШАГ 3: ИМПОРТ ОБОРУДОВАНИЯ")
print("=" * 80)

# Получение актуального списка объектов из БД
stdin, stdout, stderr = ssh.exec_command(query_objects)
db_object_codes = set(stdout.read().decode().strip().split('\n'))

# Фильтрация оборудования только для существующих объектов
equipment_to_import = [
    eq for eq in equipment_from_excel 
    if eq["object_code"] in db_object_codes and eq["equipment_type"] in db_types
]

print(f"\nОборудования для импорта: {len(equipment_to_import)}")

# Импорт через админский эндпоинт
# Создаём Excel файл для импорта
import pandas as pd

# Подготовка данных
import_data = []
for eq in equipment_to_import:
    import_data.append({
        "object_code": eq["object_code"],
        "equipment_type": eq["equipment_type"],
        "room_type": eq.get("room_type") if eq.get("room_type") != "Объект" else "",
        "brand": eq["brand"],
        "model": eq["model"],
        "serial_number": eq["serial_number"],
        "location_description": eq.get("location_description", ""),
    })

df = pd.DataFrame(import_data)
df.to_excel("upload/import-equipment.xlsx", index=False)
print(f"\n✓ Файл для импорта создан: upload/import-equipment.xlsx")
print(f"  Строк: {len(import_data)}")

# Копирование файла на сервер
sftp = ssh.open_sftp()
sftp.put("upload/import-equipment.xlsx", "/tmp/import-equipment.xlsx")
sftp.close()
print(f"\n✓ Файл скопирован на сервер")

ssh.close()

print("\n" + "=" * 80)
print("ГОТОВО!")
print("=" * 80)
print(f"\nДобавлено объектов: {added_objects}")
print(f"Оборудования для импорта: {len(equipment_to_import)}")
print(f"\nСледующий шаг: загрузить оборудование через админский импорт Excel")
