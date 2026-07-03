# Инструкция по деплою на VPS

## Требования
- VPS/VDS с Ubuntu 22.04+ (минимум 2 ГБ RAM)
- Домен, привязанный к IP сервера
- SSL-сертификат (или Let's Encrypt)

---

## 1. Подготовка сервера

Подключитесь к серверу по SSH:
```bash
ssh root@your-server-ip
```

Установите Git и склонируйте проект:
```bash
apt update && apt install -y git
cd /opt
git clone https://github.com/Nosferatu-msk/web-app-check-list.git checklist
cd checklist
```

---

## 2. Конфигурация

Скопируйте пример .env и отредактируйте:
```bash
cp .env.production.example .env
nano .env
```

**Обязательно замените:**
- `DB_PASS` — пароль для PostgreSQL
- `JWT_SECRET` — случайная строка (минимум 32 символа)
- `CLIENT_URL` — ваш домен (например, `https://checklist.your-domain.com`)

Сгенерировать случайную строку:
```bash
openssl rand -hex 32
```

---

## 3. Автоматический деплой

Запустите скрипт:
```bash
chmod +x deploy.sh
./deploy.sh
```

Скрипт автоматически:
1. Установит Docker (если не установлен)
2. Соберёт образы
3. Запустит контейнеры
4. Применит миграции БД
5. Заполнит справочники

---

## 4. Настройка SSL (Nginx + Let's Encrypt)

Если нужен HTTPS, установите Certbot:
```bash
apt install -y certbot
```

Остановите контейнер client (освобождает порт 80):
```bash
docker compose -f docker-compose.prod.yml stop client
```

Получите сертификат:
```bash
certbot certonly --standalone -d your-domain.com
```

Создайте Nginx-конфиг для SSL:
```bash
nano /etc/nginx/sites-available/checklist
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20M;
    }
}
```

> **Примечание:** Измените порт client в `docker-compose.prod.yml` на `8080:80`, чтобы Nginx слушал 443.

Активируйте:
```bash
ln -s /etc/nginx/sites-available/checklist /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 5. Ручной деплой (без скрипта)

```bash
# Сборка
docker compose -f docker-compose.prod.yml build

# Запуск
docker compose -f docker-compose.prod.yml up -d

# Миграции
docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy

# Seed (справочники)
docker compose -f docker-compose.prod.yml exec -T server npx tsx prisma/seed.ts
```

---

## 6. Управление

```bash
# Логи
docker compose -f docker-compose.prod.yml logs -f

# Логи только сервера
docker compose -f docker-compose.prod.yml logs -f server

# Перезапуск
docker compose -f docker-compose.prod.yml restart

# Остановка
docker compose -f docker-compose.prod.yml down

# Обновление (после git pull)
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

---

## 7. Резервное копирование

Создайте скрипт бэкапа:
```bash
#!/bin/bash
BACKUP_DIR=/opt/backups
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Бэкап БД
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U checklist checklist > $BACKUP_DIR/db_$DATE.sql

# Бэкап фото
docker run --rm -v checklist_uploads:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/uploads_$DATE.tar.gz /data

# Удаление старых бэкапов (старше 30 дней)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

Добавьте в crontab:
```bash
crontab -e
# Каждый день в 3:00
0 3 * * * /opt/checklist/backup.sh
```

---

## 8. Обновление приложения

```bash
cd /opt/checklist
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

---

## Структура production-окружения

```
┌──────────────────────────────────────────┐
│              VPS (Ubuntu)                 │
│                                          │
│  ┌─────────┐    ┌─────────────────────┐  │
│  │  Nginx  │───▶│  client (React PWA) │  │
│  │ :80/443 │    │  порт 80 (internal) │  │
│  └────┬────┘    └─────────────────────┘  │
│       │                                  │
│       │ /api/*                           │
│       ▼                                  │
│  ┌─────────────────────┐                 │
│  │  server (Express)   │                 │
│  │  порт 3001           │                 │
│  └────────┬────────────┘                 │
│           │                              │
│           ▼                              │
│  ┌─────────────────────┐                 │
│  │  PostgreSQL 15      │                 │
│  │  порт 5432 (local)  │                 │
│  └─────────────────────┘                 │
│                                          │
│  Volumes: pgdata, uploads, reports       │
└──────────────────────────────────────────┘
```

---

## Тестовые аккаунты после деплоя

| Роль | Email | Пароль |
|------|-------|--------|
| Администратор | admin@example.com | admin123 |
| Инженер | engineer@example.com | engineer123 |

> ⚠️ **Смените пароли** после первого входа!
