# Модуль автоматического тестирования (E2E)

Автоматические end-to-end тесты на базе **Playwright**.

## Быстрый старт

```bash
# Запуск всех тестов
npm run test:e2e

# Запуск с UI (интерактивный режим)
npm run test:e2e:ui

# Просмотр отчёта после запуска
npm run test:e2e:report

# Запуск перед деплоем (с отчётом)
npm run test:pre-deploy
```

## Структура тестов

```
e2e/
├── auth.spec.ts          — TC-001..003: Авторизация
├── visits.spec.ts        — TC-004..006: Создание визитов
├── admin.spec.ts         — Админ-панель, меню, breadcrumbs
└── ui-redesign.spec.ts   — Проверка UI-редизайна (P0-P3)
```

## Тестовые аккаунты

| Роль | Email | Пароль |
|---|---|---|
| Инженер | engineer@example.com | engineer123 |
| Админ | admin@example.com | admin123 |

## Отчёты

После запуска тестов генерируются:
- **HTML-отчёт**: `test-reports/html/index.html`
- **JSON-отчёт**: `test-reports/results.json`
- **Скриншоты**: `test-results/` (при падениях)
- **Видео**: `test-results/` (при падениях)

## Покрытие

| Область | Тесты | Статус |
|---|---|---|
| Авторизация (вход, ошибки) | 4 | ✅ |
| Создание визитов | 4 | ✅ |
| Админ-панель (меню, навигация) | 5 | ✅ |
| UI-редизайн (P0-P3) | 7 | ✅ |
| **Итого** | **20** | ✅ |

## Требования

- Node.js 18+
- Запущенные серверы: `docker compose up -d` + `cd server && npm run dev` + `cd client && npm run dev`
- Или Playwright запустит клиент автоматически через `webServer` в конфиге

## Добавление новых тестов

1. Создайте файл `e2e/<имя>.spec.ts`
2. Используйте `test.describe` для группировки
3. Для авторизации используйте `beforeEach` с логином
4. Добавляйте комментарии с номером тест-кейса (TC-XXX)

## CI/CD (будущее)

Для интеграции в CI добавьте в GitHub Actions:

```yaml
- name: Run E2E tests
  run: |
    docker compose up -d
    cd server && npm run dev &
    cd client && npm run dev &
    npx playwright test
```
