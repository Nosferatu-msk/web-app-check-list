# Иконки и графика для мобильного приложения

## Необходимые файлы

### 1. Иконка приложения (icon.png)
- **Размер:** 1024x1024 px
- **Формат:** PNG с прозрачностью
- **Содержание:** Логотип "Чек-лист инженера" на фоне #0F766E (trust teal)
- **Где использовать:** Google Play, домашний экран устройства

### 2. Адаптивная иконка (adaptive-icon.png)
- **Размер:** 1024x1024 px
- **Формат:** PNG
- **Содержание:** Логотип без фона (для Android adaptive icons)
- **Foreground:** Логотип в центре (безопасная зона 66%)
- **Background:** Цвет #0F766E или градиент

### 3. Splash screen (splash.png)
- **Размер:** 1284x2778 px (или кратно)
- **Формат:** PNG
- **Содержание:** Логотип по центру на фоне #0F766E
- **Текст:** "Чек-лист инженера" (опционально)

### 4. Favicon (favicon.png)
- **Размер:** 48x48 px
- **Формат:** PNG
- **Содержание:** Упрощённый логотип

## Как сгенерировать

### Вариант 1: AI-генерация (Midjourney, DALL-E)
```
Prompt: "Mobile app icon for engineer checklist app, minimalist design, 
teal color #0F766E, clipboard with checkmark, professional, clean, 
flat design, 1024x1024"
```

### Вариант 2: Figma/Canva
1. Создать дизайн 1024x1024
2. Фон: #0F766E
3. Иконка: clipboard-check из Material Design Icons
4. Текст: "Чек-лист" (опционально)

### Вариант 3: Использовать существующий логотип
Если есть логотип веб-приложения — адаптировать его.

## После создания

1. Поместить файлы в папку `mobile/assets/`:
   - `icon.png` (1024x1024)
   - `adaptive-icon.png` (1024x1024)
   - `splash.png` (1284x2778)
   - `favicon.png` (48x48)

2. Проверить `app.json` — пути должны совпадать

3. Пересобрать приложение:
   ```bash
   cd mobile
   eas build --platform android --profile preview
   ```

## Цветовая палитра

- **Primary:** #0F766E (trust teal)
- **Secondary:** #14B8A6
- **Background:** #0F766E (для splash)
- **Text:** #FFFFFF (на тёмном фоне)
