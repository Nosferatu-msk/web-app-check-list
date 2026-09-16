# 🧪 Модуль автотестирования web-app-autotest

Универсальный модуль E2E + API тестирования для веб-приложений. Не зависит от основного проекта.

## Стек

- **Playwright** — браузерное E2E + API тестирование
- **TypeScript** — типобезопасность
- **Кастомный Markdown-репортёр** — отчёты в формате `.md`

## Быстрый старт

```bash
# 1. Перейти в директорию модуля
cd autotest

# 2. Установить зависимости
npm install

# 3. Установить браузеры
npx playwright install chromium

# 4. Скопировать и настроить конфиг
cp .env.example .env
# Отредактировать .env — указать URL и учётные данные

# 5. Запустить тесты
npm test
```

## Конфигурация

Скопируйте `.env.example` в `.env` и укажите параметры вашего приложения:

```env
TEST_BASE_URL=https://your-app.com
TEST_API_URL=https://your-app.com/api
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=your-password
TEST_TM_EMAIL=tm@example.com
TEST_TM_PASSWORD=your-password
TEST_ENGINEER_EMAIL=engineer@example.com
TEST_ENGINEER_PASSWORD=your-password
```

## Скрипты запуска

| Команда | Описание |
|---------|----------|
| `npm test` | Полный прогон всех тестов |
| `npm run test:ui` | Только UI-тесты (браузер) |
| `npm run test:api` | Только API-тесты (без браузера) |
| `npm run test:critical` | Только критические тесты |
| `npm run test:high` | Только высокоприоритетные |
| `npm run test:auth` | Тесты авторизации |
| `npm run test:visits` | Тесты визитов |
| `npm run test:admin` | Тесты админки |
| `npm run report` | Прогон с генерацией Markdown-отчёта |
| `npm run report:html` | Прогон с HTML-отчётом Playwright |

## Структура

```
autotest/
├── config/
│   └── test-config.ts        # Конфигурация (URL, креды, таймауты)
├── helpers/
│   ├── auth.ts               # Авторизация (UI + API)
│   ├── api-client.ts         # REST API клиент
│   └── md-reporter.ts        # Генератор Markdown-отчётов
├── tests/
│   ├── auth/                 # Авторизация (TC-001..003, TC-046, TC-052)
│   ├── visits/               # Визиты и задачи (TC-004..012, TC-024..032)
│   ├── photos/               # Фотофиксация (TC-019, TC-041)
│   ├── reports/              # Отчёты (TC-027, TC-095, TC-100, TC-106, TC-109)
│   ├── admin/                # Админка (TC-033..036)
│   ├── tm/                   # ТМ (TC-053..064)
│   ├── offline/              # Офлайн-режим (TC-038, TC-068, TC-074)
│   ├── import/               # CSV-импорт (TC-076..088)
│   ├── specialization/       # Специализация (TC-111..116)
│   ├── profile/              # Личный кабинет (TC-117..125)
│   └── pagination/           # Пагинация (TC-097, TC-098)
├── reports/                  # Сгенерированные отчёты (.md)
├── playwright.config.ts
├── package.json
└── tsconfig.json
```

## Отчёты

После запуска `npm run report` в директории `reports/` создаётся файл:

```
reports/test-report_2026-07-16_20-30.md
```

Отчёт содержит:
- 📊 **Сводку** — всего/пройдено/провалено/пропущено
- 🎯 **По приоритетам** — critical/high с разбивкой
- ❌ **Проваленные тесты** — с описанием ошибки и стеком
- 📋 **Полный список** — таблица всех тестов со статусами

## Теги тестов

Каждый тест помечен тегами для фильтрации:

| Тег | Описание |
|-----|----------|
| `@critical` | Критические тесты (основной функционал) |
| `@high` | Высокий приоритет |
| `@medium` | Средний приоритет |
| `@ui` | UI-тесты (требуют браузер) |
| `@api` | API-тесты (без браузера) |

## Адаптация для другого проекта

1. Измените `config/test-config.ts` — укажите URL и роли
2. Обновите `playwright.config.ts` — добавьте нужные браузеры
3. Напишите тесты в `tests/` — используйте `loginViaUI()` и `ApiClient`
4. Запустите `npm test`

## Генерация тестов из Тест-кейсы.md

При обновлении файла `Тест-кейсы.md` запустите генератор:

```bash
npm run generate
```

Скрипт:
1. Парсит `Тест-кейсы.md` (путь: `../Тест-кейсы.md` или через `TEST_CASES_FILE`)
2. Находит все TC-XXX
3. Проверяет, какие уже реализованы в `tests/**/*.spec.ts`
4. Для отсутствующих генерирует шаблоны `.spec.ts` с TODO-комментариями
5. Выводит отчёт о сгенерированных файлах

После генерации реализуйте TODO в созданных файлах.

## Пример написания теста

```typescript
import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';
import { ApiClient } from '../../helpers/api-client.js';

test('Мой тест @critical @ui', async ({ page }) => {
  await loginViaUI(page, 'engineer');
  await page.goto('/');
  await expect(page.locator('.ant-table').first()).toBeVisible();
});

test('Мой API тест @high @api', async ({ request }) => {
  const api = new ApiClient(request);
  await api.authenticate('admin');
  const res = await api.get('/visits');
  expect(res.ok()).toBeTruthy();
});
```
