# Maestro E2E тесты

## Установка Maestro CLI

### Windows (PowerShell от администратора):
```powershell
curl -Ls "https://get.maestro.mobile.dev" | powershell
```

### macOS/Linux:
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### Проверка установки:
```bash
maestro --version
```

## Запуск тестов

### 1. Запустить эмулятор Android или подключить устройство

### 2. Собрать и установить приложение:
```bash
cd mobile
npm run android
```

### 3. Запустить все тесты:
```bash
maestro test maestro/
```

### 4. Запустить конкретный тест:
```bash
maestro test maestro/01-tab-navigation.yaml
```

### 5. Запустить с записью видео:
```bash
maestro test maestro/ --format video
```

## Тестовые сценарии

| Файл | Что тестирует |
|------|---------------|
| `01-tab-navigation.yaml` | Переход между вкладками (визиты → заявки → профиль) |
| `02-login-and-visits.yaml` | Логин и отображение списка визитов |
| `03-create-visit.yaml` | Создание нового визита |
| `04-open-task.yaml` | Открытие задачи из визита |

## Интеграция с CI

Добавить в GitHub Actions:
```yaml
- name: Install Maestro
  run: curl -Ls "https://get.maestro.mobile.dev" | bash

- name: Run E2E tests
  run: maestro test mobile/maestro/
```

## Полезные команды

```bash
# Показать доступные устройства
maestro studio

# Записать новый тест (интерактивно)
maestro record

# Очистить данные приложения
maestro clear-keychain

# Скриншот экрана
maestro screenshot
```
