# Мобильное приложение «Чек-лист инженера»

React Native (Expo) приложение для Android.

## Разработка

```bash
# Установка зависимостей
npm install

# Запуск Metro bundler
npm start

# Запуск на Android (эмулятор или устройство)
npm run android
```

## Структура

```
mobile/
├── app/              # Expo Router (файловая навигация)
│   ├── (auth)/       # Авторизация
│   ├── (tabs)/       # Нижняя навигация
│   └── _layout.tsx   # Корневой layout
├── src/
│   ├── api/          # HTTP-клиент
│   ├── components/   # UI-компоненты
│   ├── stores/       # Zustand stores
│   └── theme/        # Тема оформления
└── shared/           # Symlink на ../shared/types
```

## Документация

- [ТЗ](../ТЗ-Мобильное-приложение.md)
- [Спецификация](../Спецификация-мобильное-приложение.md)
- [Макет UI](../mockups-mobile-v1.html)
