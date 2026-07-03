#!/bin/bash
set -e

echo "========================================="
echo "  Деплой «Чек-лист инженера»"
echo "========================================="

# ─── 1. Проверка Docker ─────────────────────
if ! command -v docker &> /dev/null; then
    echo "📦 Устанавливаю Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker && systemctl start docker
    echo "✅ Docker установлен"
else
    echo "✅ Docker уже установлен: $(docker --version)"
fi

if ! command -v docker compose &> /dev/null; then
    echo "📦 Устанавливаю Docker Compose..."
    apt-get update && apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose установлен"
else
    echo "✅ Docker Compose уже установлен"
fi

# ─── 2. Проверка .env ───────────────────────
if [ ! -f .env ]; then
    echo "⚠️  Файл .env не найден!"
    echo "   Скопируйте .env.production.example в .env и заполните:"
    echo "   cp .env.production.example .env"
    echo "   nano .env"
    exit 1
fi
echo "✅ .env найден"

# ─── 3. Сборка и запуск ─────────────────────
echo "🔨 Собираю образы..."
docker compose -f docker-compose.prod.yml build

echo "🚀 Запускаю контейнеры..."
docker compose -f docker-compose.prod.yml up -d

echo "⏳ Ожидание готовности БД..."
sleep 5

# ─── 4. Миграция и seed ─────────────────────
echo "📋 Применяю миграции..."
docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy

echo "🌱 Заполняю справочники..."
docker compose -f docker-compose.prod.yml exec -T server npx tsx prisma/seed.ts

# ─── 5. Результат ────────────────────────────
echo ""
echo "========================================="
echo "  ✅ Деплой завершён!"
echo "========================================="
echo ""
echo "  Приложение: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "  Тестовые аккаунты:"
echo "    Инженер: engineer@example.com / engineer123"
echo "    Админ:   admin@example.com / admin123"
echo ""
echo "  Логи: docker compose -f docker-compose.prod.yml logs -f"
echo "  Стоп: docker compose -f docker-compose.prod.yml down"
echo "========================================="
