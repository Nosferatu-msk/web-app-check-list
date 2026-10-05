#!/usr/bin/env python3
"""
Сравнение данных из Excel с базой данных и подготовка отчёта
"""

import json
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

# Анализ объектов
print("\n" + "=" * 80)
print("АНАЛИЗ ОБЪЕКТОВ")
print("=" * 80)

object_codes_from_excel = [obj["object_code"] for obj in objects_from_excel]
print(f"\nВсего кодов объектов в Excel: {len(object_codes_from_excel)}")
print(f"Уникальных кодов: {len(set(object_codes_from_excel))}")

# Проверка на дубликаты
from collections import Counter
code_counts = Counter(object_codes_from_excel)
duplicates = {code: count for code, count in code_counts.items() if count > 1}
if duplicates:
    print(f"\n⚠ Найденные дубликаты кодов ({len(duplicates)}):")
    for code, count in list(duplicates.items())[:10]:
        print(f"  - {code}: {count} раз")
else:
    print(f"\n✓ Дубликатов не найдено")

# Анализ оборудования
print("\n" + "=" * 80)
print("АНАЛИЗ ОБОРУДОВАНИЯ")
print("=" * 80)

equipment_codes_from_excel = [eq["object_code"] for eq in equipment_from_excel]
print(f"\nВсего записей оборудования: {len(equipment_from_excel)}")
print(f"Уникальных кодов объектов: {len(set(equipment_codes_from_excel))}")

# Проверка связей объект-оборудование
objects_with_equipment = set(equipment_codes_from_excel)
objects_without_equipment = set(object_codes_from_excel) - objects_with_equipment

print(f"\nОбъектов с оборудованием: {len(objects_with_equipment)}")
print(f"Объектов без оборудования: {len(objects_without_equipment)}")

if objects_without_equipment:
    print(f"\n⚠ Объекты без оборудования ({len(objects_without_equipment)}):")
    for code in list(objects_without_equipment)[:20]:
        obj = next(o for o in objects_from_excel if o["object_code"] == code)
        print(f"  - {code}: {obj['full_address']}")
    if len(objects_without_equipment) > 20:
        print(f"  ... и ещё {len(objects_without_equipment) - 20}")

# Анализ типов оборудования
print("\n" + "=" * 80)
print("ТИПЫ ОБОРУДОВАНИЯ")
print("=" * 80)

equipment_types = [eq["equipment_type"] for eq in equipment_from_excel]
type_counts = Counter(equipment_types)
print(f"\nУникальных типов оборудования: {len(type_counts)}")
print(f"\nТоп-10 типов:")
for eq_type, count in type_counts.most_common(10):
    print(f"  {eq_type}: {count}")

# Анализ помещений
print("\n" + "=" * 80)
print("ТИПЫ ПОМЕЩЕНИЙ")
print("=" * 80)

room_types = [eq["room_type"] for eq in equipment_from_excel if eq.get("room_type")]
room_counts = Counter(room_types)
print(f"\nУникальных типов помещений: {len(room_counts)}")
print(f"\nТоп-10 помещений:")
for room_type, count in room_counts.most_common(10):
    print(f"  {room_type}: {count}")

empty_rooms = sum(1 for eq in equipment_from_excel if not eq.get("room_type"))
print(f"\nОборудования без помещения: {empty_rooms}")

# Проверка на пустые значения
print("\n" + "=" * 80)
print("ПРОВЕРКА НА ПУСТЫЕ ЗНАЧЕНИЯ")
print("=" * 80)

empty_brands = sum(1 for eq in equipment_from_excel if not eq.get("brand"))
empty_models = sum(1 for eq in equipment_from_excel if not eq.get("model"))
empty_serials = sum(1 for eq in equipment_from_excel if not eq.get("serial_number"))

print(f"\nПустых brand: {empty_brands}")
print(f"Пустых model: {empty_models}")
print(f"Пустых serial_number: {empty_serials}")

# Сохранение отчёта
print("\n" + "=" * 80)
print("СОХРАНЕНИЕ ОТЧЁТА")
print("=" * 80)

report = {
    "summary": {
        "total_objects": len(objects_from_excel),
        "unique_object_codes": len(set(object_codes_from_excel)),
        "total_equipment": len(equipment_from_excel),
        "objects_with_equipment": len(objects_with_equipment),
        "objects_without_equipment": len(objects_without_equipment),
        "unique_equipment_types": len(type_counts),
        "unique_room_types": len(room_counts),
    },
    "objects_without_equipment": list(objects_without_equipment),
    "equipment_types": dict(type_counts),
    "room_types": dict(room_counts),
    "duplicates": duplicates,
}

with open("upload/import-analysis.json", "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f"\n✓ Отчёт сохранён в upload/import-analysis.json")

print("\n" + "=" * 80)
print("ГОТОВО!")
print("=" * 80)
