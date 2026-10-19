# Структура параметров JSONB

## Содержание

- [5.1. РЩ/ГРЩ (rsch)](#51-рщгрщ-equipment_typecode-rsch)
- [5.2. Прибор учёта э/э (schetchik_electroshc)](#52-прибор-учёта-ээ-schetchik_electroshc)
- [5.3. Вентиляционная установка (vent)](#53-вентиляционная-установка-vent)
- [5.4. Внутренний блок СС (splitvn)](#54-внутренний-блок-сс-splitvn)
- [5.5. Наружный блок СС (splitnar)](#55-наружный-блок-сс-splitnar)
- [5.6. Внутренний блок МСС (mssvn)](#56-внутренний-блок-мсс-mssvn)
- [5.7. Наружный блок МСС (mssnar)](#57-наружный-блок-мсс-mssnar)
- [5.8. Внутренний блок VRV (vrv_vn)](#58-внутренний-блок-vrv-vrv_vn)
- [5.9. Наружный блок VRV (vrv_nar)](#59-наружный-блок-vrv-vrv_nar)
- [5.10. Сети водоснабжения (seti_vodosnab)](#510-сети-водоснабжения-и-водоотведения-seti_vodosnab)
- [5.11. Прибор учёта ХВС (schetchik_hvs)](#511-прибор-учёта-хвс-schetchik_hvs)
- [5.12. Прибор учёта ГВС (schetchik_gvs)](#512-прибор-учёта-гвс-schetchik_gvs)
- [5.13. Тепловые сети (teplovye_seti)](#513-тепловые-сети-teplovye_seti)
- [5.14. Автозаполнение параметров счётчиков](#514-автозаполнение-параметров-счётчиков)

Поле `tasks.parameters` хранит данные в формате JSON. Структура зависит от типа оборудования:

### 5.1. РЩ/ГРЩ (equipment_type.code = `rsch`)

```json
{
  "contact_connections": "satisfactory",     // Удовлетворительно / Неудовлетворительно
  "neutral_conductor": "satisfactory",
  "grounding_circuit": "satisfactory",
  "wire_condition": "satisfactory",
  "locking_devices": true,                   // Да / Нет
  "emergency_lighting": true,
  "rcd_breakers": true,
  "conclusion": "ok",                        // ok / ok_with_notes / faulty
  "selected_recommendations": ["uuid1", "uuid2"],
  "additional_recommendations": ""
}
```

### 5.2. Прибор учёта э/э (`schetchik_electroshc`)

```json
{
  "model": "Меркурий 230",
  "serial_number": "12345679-25",
  "current_transformer": false,              // Да / Нет
  "seal_present": true,
  "readings": 123458.87,
  "conclusion": "ok",
  "selected_recommendations": [],
  "additional_recommendations": ""
}
```

### 5.3. Вентиляционная установка (`vent`)

```json
{
  "unit_present": true,
  "operating_mode": "on",                    // on / off
  "controller_errors": false,
  "extraneous_noise": false,
  "filter_condition": "clean",               // clean / needs_replacement
  "temperature_before": 22.5,                // °C
  "temperature_after": 18.0,
  "conclusion": "ok",
  "selected_recommendations": [],
  "additional_recommendations": ""
}
```

### 5.4. Внутренний блок СС (`splitvn`)

```json
{
  "operability": "satisfactory",
  "extraneous_noise": false,
  "room_temperature": 18.0,                  // °C
  "filter_condition": "needs_cleaning",      // clean / needs_cleaning
  "drain_flush_needed": false,
  "refrigerant_leaks": false,
  "cooling_capacity_kw": 2.35,
  "conclusion": "ok",
  "selected_recommendations": [],
  "additional_recommendations": ""
}
```

### 5.5. Наружный блок СС (`splitnar`)

```json
{
  "operability": "satisfactory",
  "line_leaks": false,
  "extraneous_noise": false,
  "unit_flush_needed": false,
  "conclusion": "ok",
  "selected_recommendations": [],
  "additional_recommendations": ""
}
```

### 5.6. Внутренний блок МСС (`mssvn`)
Структура аналогична 5.4 (внутренний блок СС).

### 5.7. Наружный блок МСС (`mssnar`)
Структура аналогична 5.5 (наружный блок СС).

### 5.8. Внутренний блок VRV (`vrv_vn`)
Структура аналогична 5.4 (внутренний блок СС).

### 5.9. Наружный блок VRV (`vrv_nar`)
Структура аналогична 5.5 (наружный блок СС).

### 5.10. Сети водоснабжения и водоотведения (`seti_vodosnab`)

```json
{
  "hvs_pipe_damage": false,
  "hws_pipe_damage": false,
  "hvs_corrosion": false,
  "hws_corrosion": false,
  "hvs_leaks": false,
  "hws_leaks": false,
  "fastener_issues": false,
  "hvs_other_issues": false,
  "hws_other_issues": false,
  "valve_tightness": false,
  "drain_condition": "clean",                // clean / needs_cleaning
  "conclusion": "ok",
  "selected_recommendations": [],
  "additional_recommendations": ""
}
```

### 5.11. Прибор учёта ХВС (`schetchik_hvs`)

```json
{
  "model": "...",
  "serial_number": "...",
  "seal_present": true,
  "readings": 0,
  "conclusion": "ok",
  "selected_recommendations": [],
  "additional_recommendations": ""
}
```

### 5.12. Прибор учёта ГВС (`schetchik_gvs`)
Структура аналогична 5.11.

### 5.13. Тепловые сети (`teplovye_seti`)

```json
{
  "pipe_damage": false,
  "corrosion": false,
  "leaks": false,
  "fastener_issues": false,
  "other_issues": false,
  "valve_tightness": true,
  "air_locks": false,
  "instruments_ok": true,
  "heating_temperature": null,               // °C (опционально)
  "conclusion": "ok",
  "selected_recommendations": [],
  "additional_recommendations": ""
}
```

### 5.14. Автозаполнение параметров счётчиков

Для задач, связанных с приборами учёта (коды оборудования: `schetchik_electroshc`, `schetchik_hvs`, `schetchik_gvs`), при наличии связанного `objectEquipmentId` выполняется **автозаполнение** полей:

- **`model`** — из `task.brand` + `task.model` (объединяются через пробел, если оба заполнены; если только один — берётся заполненный)
- **`serial_number`** — из `task.serialNumber`

Автозаполнение срабатывает при создании задачи из привязки объекта (когда в `object_equipment` указаны марка/модель/серийный номер). Пользователь может изменить автозаполненные значения вручную.

---

## См. также

- [API-контракты](api-contracts.md) — REST API системы
- [Бизнес-логика](business-logic.md) — валидация обязательных полей
- [Модель данных](data-model.md) — таблица tasks и поле parameters

---

## 6. БИЗНЕС-ЛОГИКА