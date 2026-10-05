# Проблема входа пользователя alyurkar@gmail.com

## Диагноз

**Корень проблемы:** В роуте `/api/auth/login` email **не очищался от пробелов** перед поиском в базе данных.

### Что происходило

1. Пользователь зарегистрирован с email `alyurkar@gmail.com` (без пробелов)
2. При вводе в форму логина случайно добавляются пробелы: `alyurkar@gmail.com ` (с пробелом в конце)
3. Zod-валидация `z.string().email()` пропускает такой email (пробелы допустимы по стандарту)
4. PostgreSQL с `mode: 'insensitive'` **не находит** пользователя, потому что email не совпадает точно
5. Пользователь получает ошибку "Неверный email или пароль"

### Где было исправлено

**Файлы изменены:**

1. **`server/src/routes/auth.ts`** (строка 30)
   - Добавлена нормализация email: `email.toLowerCase().trim()`
   - Применено в `/login` и `/forgot-password`

2. **`client/src/store/authStore.ts`** (строка 31)
   - Добавлена защитная нормализация на клиенте: `email.trim().toLowerCase()`
   - Теперь email автоматически очищается перед отправкой на сервер

## Инструкция по деплою исправления

### Шаг 1: Пересобрать сервер

```bash
cd server
npm run build
```

### Шаг 2: Пересобрать клиент

```bash
cd client
npm run build
```

### Шаг 3: Задеплоить на production

```bash
# Локальная сборка образов
docker compose -f docker-compose.prod.yml build

# Перезапуск сервисов
docker compose -f docker-compose.prod.yml up -d

# Или использовать автоматический деплой
./deploy.sh
```

### Шаг 4: Проверить состояние пользователя на сервере

**Вариант A: Использовать готовый скрипт**

```bash
# На Windows (из корня проекта)
scripts\diagnose-alyurkar-user.bat

# Или вручную через SSH
ssh root@185.251.90.36
```

**Вариант B: SQL-запрос вручную**

```bash
ssh root@185.251.90.36

# Внутри SSH
docker exec -it check-list-db-1 psql -U checklist -d checklist

# SQL-запрос для проверки
SELECT id, email, role, is_active, created_at, "fullName"
FROM users 
WHERE email LIKE '%alyurkar%';

# Если есть пробелы — исправить
UPDATE users 
SET email = LOWER(TRIM(email))
WHERE email LIKE '%alyurkar%'
  AND (email != TRIM(email) OR email != LOWER(email));

# Выход
\q
exit
```

## Проверка исправления

После деплоя пользователь `alyurkar@gmail.com` сможет войти, даже если:
- Случайно добавит пробелы в начале или конце email
- Использует верхний регистр: `Alyurkar@Gmail.com`
- Копирует email из буфера обмена с лишними пробелами

## Дополнительные рекомендации

### 1. Добавить валидацию на клиенте

Можно добавить дополнительную проверку в `LoginPage.tsx`:

```typescript
const onFinish = async (values: { email: string; password: string }) => {
  setLoading(true);
  try {
    // Дополнительная очистка на уровне формы
    const cleanEmail = values.email.trim().toLowerCase();
    await login(cleanEmail, values.password);
    navigate('/');
  } catch (err: any) {
    message.error(err.message || 'Ошибка входа');
  } finally {
    setLoading(false);
  }
};
```

### 2. Добавить логирование попыток входа

Для диагностики проблем в будущем можно добавить логирование:

```typescript
// В server/src/routes/auth.ts
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  
  // Логирование попытки входа (без пароля!)
  console.log(`[AUTH] Login attempt: ${normalizedEmail} (raw: ${email})`);
  
  const user = await prisma.user.findFirst({ 
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } } 
  });
  
  if (!user) {
    console.log(`[AUTH] User not found: ${normalizedEmail}`);
  }
  // ... остальной код
});
```

### 3. Массовая проверка всех пользователей

Рекомендуется проверить всех пользователей на наличие пробелов в email:

```sql
-- Найти пользователей с пробелами в email
SELECT id, email, length(email) as length
FROM users
WHERE email != TRIM(email)
   OR email != LOWER(email);

-- Исправить всех
UPDATE users
SET email = LOWER(TRIM(email))
WHERE email != TRIM(email)
   OR email != LOWER(email);
```

## Файлы для деплоя

- `scripts/diagnose-alyurkar-user.bat` — автоматическая диагностика
- `scripts/diagnose-alyurkar-user.sql` — SQL-скрипт для ручного выполнения
- `server/src/routes/auth.ts` — исправленный роут авторизации
- `client/src/store/authStore.ts` — исправленный authStore

## Статус

- ✅ Исправление кода внесено
- ✅ Сборка сервера прошла успешно
- ✅ Сборка клиента прошла успешно
- ⏳ Требуется деплой на production
- ⏳ Требуется проверка состояния пользователя в БД
