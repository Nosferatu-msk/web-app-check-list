#!/usr/bin/env python3
"""
Чтение Excel-файлов для импорта данных
"""

import pandas as pd
import json
import sys

# Чтение файла с перечнем объектов
print("=" * 80)
print("Чтение файла: Объекты МБ октябрь.xlsx")
print("=" * 80)

try:
    df_objects = pd.read_excel("upload/Объекты МБ октябрь.xlsx")
    print(f"\nВсего строк: {len(df_objects)}")
    print(f"\nКолонки: {list(df_objects.columns)}")
    print(f"\nПервые 5 строк:")
    print(df_objects.head().to_string())
    print(f"\nПоследние 5 строк:")
    print(df_objects.tail().to_string())
    
    # Проверка на пустые значения
    print(f"\nПустые значения по колонкам:")
    print(df_objects.isnull().sum())
    
    # Сохранение в JSON для дальнейшей обработки
    df_objects.to_json("upload/objects.json", orient="records", force_ascii=False, indent=2)
    print(f"\n✓ Сохранено в upload/objects.json")
    
except Exception as e:
    print(f"✗ Ошибка чтения файла объектов: {e}")
    sys.exit(1)

print("\n" + "=" * 80)
print("Чтение файла: МБ оборудование пример.xlsx")
print("=" * 80)

try:
    df_equipment = pd.read_excel("upload/МБ оборудование пример.xlsx")
    print(f"\nВсего строк: {len(df_equipment)}")
    print(f"\nКолонки: {list(df_equipment.columns)}")
    print(f"\nПервые 5 строк:")
    print(df_equipment.head().to_string())
    print(f"\nПоследние 5 строк:")
    print(df_equipment.tail().to_string())
    
    # Проверка на пустые значения
    print(f"\nПустые значения по колонкам:")
    print(df_equipment.isnull().sum())
    
    # Сохранение в JSON для дальнейшей обработки
    df_equipment.to_json("upload/equipment.json", orient="records", force_ascii=False, indent=2)
    print(f"\n✓ Сохранено в upload/equipment.json")
    
except Exception as e:
    print(f"✗ Ошибка чтения файла оборудования: {e}")
    sys.exit(1)

print("\n" + "=" * 80)
print("Готово!")
print("=" * 80)
