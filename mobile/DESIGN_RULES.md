# DESIGN_RULES.md — КРИТИЧЕСКИ ВАЖНЫЕ правила дизайна мобильного приложения

> **СТАТУС: ОБЯЗАТЕЛЬНО К РЕАЛИЗАЦИИ**
> Все правила ниже являются критически важными. При разработке любого экрана мобильного приложения
> НЕОБХОДИМО строго следовать этим правилам. Отступления недопустимы без согласования с владельцем продукта.

**Эталонный макет:** `mobile/mockups/mockups-final-v1.html` — единственный актуальный источник визуального дизайна.

---

## 1. АДАПТИВНОСТЬ (CRITICAL)

Приложение должно корректно отображаться на всех Android-устройствах:

| Параметр | Требование |
|----------|-----------|
| Минимальная ширина | 360dp (small Android) |
| Максимальная ширина | 768dp (tablets) |
| Safe area top | Status bar: 44px (динамически через `StatusBar.currentHeight`) |
| Safe area bottom | Nav bar: 42px + Home indicator: 6px (динамически через `BottomSpace`) |
| Ориентация | Только портретная |
| Масштабирование | Использовать dp/sp, НЕ px. Шрифты в sp для доступности |
| Flex-лейауты | Все контейнеры — flexbox, НЕ фиксированные размеры |
| ScrollView | Для контента, превышающего высоту экрана |

### Safe Area — обязательная структура каждого экрана:

```
┌─────────────────────────────┐
│  Status Bar (44px)          │  ← системная, не рисуем
├─────────────────────────────┤
│                             │
│  Контент экрана             │  ← padding-top: 52px (root) или header
│  (скроллится при необходимости)│
│                             │
│  padding-bottom: 70px       │  ← контент НЕ заходит под nav bar
│  (без tab bar)              │
│  padding-bottom: 130px      │  ← контент НЕ заходит под tab bar + nav bar
│  (с tab bar)                │
├─────────────────────────────┤
│  Tab Bar (63px, bottom:42px)│  ← только на root-экранах табов
├─────────────────────────────┤
│  Android Nav Bar (42px)     │  ← системная, не рисуем
│  [◻] [○] [◁]               │
└─────────────────────────────
```

---

## 2. ЦВЕТОВАЯ СИСТЕМА

| Токен | HEX | Назначение |
|-------|-----|-----------|
| Primary | `#0F766E` | Кнопки, активные табы, FAB, ссылки, иконки |
| On Primary | `#FFFFFF` | Текст на primary-кнопках |
| Secondary | `#0369A1` | Info-бейджи, индикаторы |
| Background | `#F8FAFC` | Фон экранов |
| Surface | `#FFFFFF` | Карточки, поверхности |
| Text Primary | `#0F172A` | Заголовки, основной текст |
| Text Secondary | `#64748B` | Подзаголовки, плейсхолдеры |
| Error | `#DC2626` | Ошибки, деструктивные действия |
| Success | `#059669` | Успех, завершённые статусы |
| Warning | `#D97706` | Предупреждения, pending sync |
| Border | `#E2E8F0` | Разделители, границы инпутов |
| Purple | `#7C3AED` | Бейджи заявок |

### Статусные цвета визитов:

| Статус | Цвет |
|--------|------|
| not_started | `#64748B` |
| in_progress | `#0369A1` |
| completed | `#059669` |
| sent | `#0F766E` |
| planned | `#D97706` |

---

## 3. НАВИГАЦИЯ И ШАПКИ

### Корневые экраны табов (Визиты, Заявки, Профиль):
- **БЕЗ кастомного header**
- Заголовок в контенте: 26sp, bold, цвет `#0F172A`
- SyncIndicator pill в правом верхнем углу

### Вложенные экраны (Детали визита, Задача, Фото, Отчёт, Новый визит, Добавить оборудование):
- **Кастомный header**: back-btn (40×40dp) + title (17sp/600, centered) + spacer (40px)
- Фон header: `#FFFFFF`, border-bottom: 1px `#E2E8F0`
- padding-top: 52px (status bar + header)

### Экран «Детали визита»:
- **БЕЗ header** — контент от края экрана
- Карточка визита с тенью (elevation: 2)

### Tab Bar (нижняя навигация):
- 3 вкладки: Визиты / Заявки / Профиль
- position: absolute, bottom: 42px (над Android nav bar)
- height: 63px, background: `#FFFFFF`
- Активная вкладка: иконка + текст `#0F766E`, font-weight: 600
- Неактивная: `#64748B`
- Иконки: MaterialCommunityIcons, 24×24dp

---

## 4. КАРТОЧКИ

| Тип карточки | Border Radius | Elevation | Border | Padding |
|-------------|--------------|-----------|--------|---------|
| Visit Card (список) | 14px | 1 (тень) | нет | 14px |
| Detail Card (детали визита) | 16px | 2 (тень) | нет | 16px |
| Task Card (задача) | 12px | 0 | 1px `#E2E8F0` | 12px |
| Room Card (выбор помещения) | 12px | 0 | 1.5px `#E2E8F0` | 14px |
| Equipment Item (чекбокс) | 10px | 0 | 1.5px `#E2E8F0` | 12px |
| Param Card (параметры) | 14px | 0 | 1px `#E2E8F0` | 16px |
| Photo Card | 12px | 1 (тень) | нет | 16px |
| Login Card | 16px | 3 (тень) | нет | 32px 24px |
| User Card (профиль) | 14px | 0 | нет | 16px |

---

## 5. КНОПКИ

| Тип | Height | Background | Border | Text | Radius |
|-----|--------|-----------|--------|------|--------|
| Primary (contained) | 48px | `#0F766E` | нет | 15sp/600 white | 12px |
| Success | 48px | `#059669` | нет | 15sp/600 white | 12px |
| Outlined | 48px | transparent | 1px `#0F766E` | 15sp/600 `#0F766E` | 12px |
| Danger Outlined | 48px | transparent | 1px `#DC2626` | 15sp/600 `#DC2626` | 12px |
| FAB | 56×56dp | `#0F766E` | нет | icon 28dp white | 28px (circle) |
| Season Button | 48px | `#F1F5F9` / `#0F766E` | 1.5px transparent/`#0F766E` | 14sp/500 | 12px |
| Tab Button (segmented) | 40px | `#FFFFFF` / transparent | нет | 13sp/500-600 | 10px |

**Touch target:** минимум 48×48dp для всех интерактивных элементов.

---

## 6. ТИПОГРАФИКА

| Уровень | Размер | Вес | Назначение |
|---------|--------|-----|-----------|
| Display | 26-28sp | 700 | Заголовки root-экранов |
| Title | 18-20sp | 700 | Заголовки карточек, header title |
| Subtitle | 16-17sp | 600 | Подзаголовки секций |
| Body | 14-15sp | 400-500 | Основной текст |
| Caption | 12-13sp | 400-500 | Мета-информация, подписи |
| Label | 11-12sp | 600 | Бейджи, табы |

**Правила:**
- Максимум 3 размера шрифта на одном экране
- Line height: 1.5x от размера шрифта
- Минимальный размер: 11sp (только для бейджей)

---

## 7. ИКОНКИ ОБОРУДОВАНИЯ (MaterialCommunityIcons)

| Код оборудования | Название | Иконка |
|-----------------|----------|--------|
| `rsch` | РЩ/ГРЩ | `mdi-electric-switch` — щит с автоматами |
| `vent` | Вентиляционная установка | `mdi-fan` — вентилятор с лопастями |
| `vrv_vn` | Внутренний блок VRV | `mdi-snowflake` — снежинка |
| `mssvn` | Внутренний блок МСС | `mdi-snowflake` — снежинка |
| `splitvn` | Внутренний блок СС | `mdi-snowflake` — снежинка |
| `vrv_nar` | Наружный блок VRV | `mdi-air-conditioner` |
| `mssnar` | Наружный блок МСС | `mdi-air-conditioner` |
| `splitnar` | Наружный блок СС | `mdi-air-conditioner` |
| `schetchik_gvs` | Прибор учёта ГВС | `mdi-gauge` — спидометр |
| `schetchik_hvs` | Прибор учёта ХВС | `mdi-gauge` — спидометр |
| `schetchik_electroshc` | Прибор учёта э/э | `mdi-meter-electric` |
| `seti_vodosnab` | Сети водоснабжения | `mdi-water` — капля |
| `teplovye_seti` | Тепловые сети | `mdi-thermometer` |

### Группировка климатического оборудования (КАК В PWA):
- Indoor блоки (`splitvn`, `mssvn`, `vrv_vn`) → **одна задача** «Климатическое оборудование» на помещение
- taskType: `group_climate`
- Outdoor блоки (`splitnar`, `mssnar`, `vrv_nar`) → индивидуальные задачи

---

## 8. ИКОНКИ ПОМЕЩЕНИЙ (MaterialCommunityIcons)

| Помещение | Иконка |
|-----------|--------|
| Электрощитовая | `mdi-lightning-bolt` — молния/щит |
| Серверная | `mdi-server` — серверная стойка |
| Клиентский зал | `mdi-account-group` — группа людей |
| Комната приёма пищи | `mdi-silverware-fork-knife` |
| Санузел | `mdi-toilet` |
| Кровля | `mdi-home-roof` |
| Фасад | `mdi-office-building` |
| Зона самообслуживания | `mdi-kiosk` |
| Крыльцо | `mdi-door` |
| Тепловой узел | `mdi-radiator` |
| Касса | `mdi-cash` |
| КХЦ | `mdi-package-variant` |

---

## 9. СИНХРОНИЗАЦИЯ (SyncIndicator)

Pill-индикатор в правом верхнем углу root-экранов:

| Статус | Цвет текста | Фон | Иконка |
|--------|-----------|-----|--------|
| Синхронизировано | `#059669` | `rgba(5,150,105,0.1)` | check-circle |
| Синхронизация... | `#0369A1` | `rgba(3,105,161,0.1)` | spinner |
| N не отправлено | `#D97706` | `rgba(217,119,6,0.1)` | clock |
| Ошибка | `#DC2626` | `rgba(220,38,38,0.1)` | alert-circle |

Размер pill: padding 6px 10px, border-radius 16px, font-size 12sp/600.

---

## 10. ЭКРАНЫ (полный список)

| # | Экран | Файл | Header | Tab Bar |
|---|-------|------|--------|---------|
| 1 | Login | `(auth)/login.tsx` | Нет | Нет |
| 2 | PIN Setup | `(auth)/pin-setup.tsx` | Нет | Нет |
| 3 | Unlock | `(auth)/unlock.tsx` | Нет | Нет |
| 4 | Визиты | `(tabs)/visits.tsx` | Нет (title в контенте) | Да |
| 5 | Заявки | `(tabs)/requests.tsx` | Нет (title в контенте) | Да |
| 6 | Профиль | `(tabs)/profile.tsx` | Нет (title в контенте) | Да |
| 7 | Новый визит | `visit/new.tsx` | Кастомный | Нет |
| 8 | Детали визита | `visit/[visitId]/index.tsx` | Нет (карточка от края) | Нет |
| 9 | Добавить оборудование (Шаг 1) | `visit/[visitId]/add-equipment.tsx` | Кастомный | Нет |
| 10 | Добавить оборудование (Шаг 2) | `visit/[visitId]/add-equipment.tsx` | Кастомный | Нет |
| 11 | Новое оборудование (ручной ввод) | `visit/[visitId]/add-equipment.tsx` | Кастомный | Нет |
| 12 | Задача — Параметры | `visit/[visitId]/task/[taskId].tsx` | Кастомный | Нет |
| 13 | Фото | `visit/[visitId]/task/[taskId]/photos.tsx` | Кастомный | Нет |
| 14 | Отчёт | `visit/[visitId]/report.tsx` | Кастомный | Нет |

---

## 11. КРИТИЧЕСКИЕ ПАТТЕРНЫ UX

### Empty State:
- Никогда не показывать пустой экран
- Иконка + сообщение + CTA-кнопка
- Пример: «Нет визитов» → «Создайте первый визит»

### Loading State:
- Skeleton screens при загрузке > 300ms
- ActivityIndicator при загрузке < 1s

### Error State:
- Всегда путь восстановления (retry, back)
- Конкретные сообщения: не «Ошибка», а «Не удалось загрузить визиты»

### Формы:
- Labels всегда видны над полем (НЕ placeholder-only)
- Валидация on blur
- Required: asterisk `*` или «(обязательно)»

### Голосовой ввод:
- Кнопка микрофона в правом нижнем углу поля «Примечание»
- Размер: 36×36dp, круглая, background `#0F766E`

---

## 12. АНИМАЦИИ

| Тип | Длительность | Easing |
|-----|-------------|--------|
| Micro feedback | 100-150ms | ease-out |
| Entry | 200-300ms | ease-out |
| Exit | 150-200ms | ease-in |
| Transition | 300-400ms | ease-in-out |

**Правила:**
- Анимировать максимум 1-2 элемента на view
- Только `transform` и `opacity` (GPU-accelerated)
- НЕ анимировать `width`, `height`, `top`, `left`

---

## 13. ДОСТУПНОСТЬ (a11y)

- Каждый интерактивный элемент: `accessibilityLabel`
- Семантические роли: `button`, `link`, `header`, `search`, `image`
- Минимальный размер шрифта: 14sp (body), 12sp (captions only)
- Контраст текста: минимум 4.5:1 (WCAG AA)
- Статусы: НЕ только цветом — всегда иконка + текст

---

## 14. ИКОНКА ПРИЛОЖЕНИЯ

- Файл: `mobile/assets/icon.png`
- Teal-фон `#0F766E` + белая галочка (checkmark)
- Border radius: 20px (squircle)
- Используется на экране Login

---

*Последнее обновление: 2026-09-01*
*Эталонный макет: `mobile/mockups/mockups-final-v1.html`*
