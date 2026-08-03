-- Миграция: Модуль МТР (Мелкий текущий ремонт)
-- Дата: 2026-08-04

-- 1. Расширение enum UserRole
ALTER TYPE "UserRole" ADD VALUE 'engineer_mtr';
ALTER TYPE "UserRole" ADD VALUE 'tm_mtr';

-- 2. Создание enum MtrVisitStatus
CREATE TYPE "MtrVisitStatus" AS ENUM ('draft', 'in_progress', 'completed', 'sent', 'rejected', 'accepted');

-- 3. Таблица mtr_work_types (Виды работ МТР)
CREATE TABLE "mtr_work_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mtr_work_types_pkey" PRIMARY KEY ("id")
);

-- 4. Таблица mtr_visits (Визиты МТР)
CREATE TABLE "mtr_visits" (
    "id" TEXT NOT NULL,
    "engineer_id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "request_number" TEXT NOT NULL,
    "date_start" TIMESTAMP(3) NOT NULL,
    "time_start" TEXT NOT NULL,
    "status" "MtrVisitStatus" NOT NULL DEFAULT 'draft',
    "is_draft" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mtr_visits_pkey" PRIMARY KEY ("id")
);

-- 5. Таблица mtr_visit_works (Работы в визите МТР)
CREATE TABLE "mtr_visit_works" (
    "id" TEXT NOT NULL,
    "mtr_visit_id" TEXT NOT NULL,
    "mtr_work_type_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mtr_visit_works_pkey" PRIMARY KEY ("id")
);

-- 6. Таблица mtr_tm_objects (Привязка объектов к ТМ МТР)
CREATE TABLE "mtr_tm_objects" (
    "id" TEXT NOT NULL,
    "tm_id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mtr_tm_objects_pkey" PRIMARY KEY ("id")
);

-- 7. Таблица mtr_tm_engineers (Привязка инженеров МТР к ТМ МТР)
CREATE TABLE "mtr_tm_engineers" (
    "id" TEXT NOT NULL,
    "tm_id" TEXT NOT NULL,
    "engineer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mtr_tm_engineers_pkey" PRIMARY KEY ("id")
);

-- 8. Добавление поля mtr_visit_id в photos
ALTER TABLE "photos" ADD COLUMN "mtr_visit_id" TEXT;

-- 9. Внешние ключи для mtr_visits
ALTER TABLE "mtr_visits" ADD CONSTRAINT "mtr_visits_engineer_id_fkey" FOREIGN KEY ("engineer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mtr_visits" ADD CONSTRAINT "mtr_visits_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mtr_visits" ADD CONSTRAINT "mtr_visits_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mtr_visits" ADD CONSTRAINT "mtr_visits_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 10. Внешние ключи для mtr_visit_works
ALTER TABLE "mtr_visit_works" ADD CONSTRAINT "mtr_visit_works_mtr_visit_id_fkey" FOREIGN KEY ("mtr_visit_id") REFERENCES "mtr_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mtr_visit_works" ADD CONSTRAINT "mtr_visit_works_mtr_work_type_id_fkey" FOREIGN KEY ("mtr_work_type_id") REFERENCES "mtr_work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 11. Внешние ключи для mtr_tm_objects
ALTER TABLE "mtr_tm_objects" ADD CONSTRAINT "mtr_tm_objects_tm_id_fkey" FOREIGN KEY ("tm_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mtr_tm_objects" ADD CONSTRAINT "mtr_tm_objects_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 12. Внешние ключи для mtr_tm_engineers
ALTER TABLE "mtr_tm_engineers" ADD CONSTRAINT "mtr_tm_engineers_tm_id_fkey" FOREIGN KEY ("tm_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mtr_tm_engineers" ADD CONSTRAINT "mtr_tm_engineers_engineer_id_fkey" FOREIGN KEY ("engineer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 13. Внешний ключ для photos.mtr_visit_id
ALTER TABLE "photos" ADD CONSTRAINT "photos_mtr_visit_id_fkey" FOREIGN KEY ("mtr_visit_id") REFERENCES "mtr_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 14. Уникальные ограничения
CREATE UNIQUE INDEX "mtr_visits_request_number_key" ON "mtr_visits"("request_number");
CREATE UNIQUE INDEX "mtr_tm_objects_tm_id_address_id_key" ON "mtr_tm_objects"("tm_id", "address_id");
CREATE UNIQUE INDEX "mtr_tm_engineers_engineer_id_key" ON "mtr_tm_engineers"("engineer_id");

-- 15. Индексы
CREATE INDEX "mtr_visits_engineer_id_idx" ON "mtr_visits"("engineer_id");
CREATE INDEX "mtr_visits_address_id_idx" ON "mtr_visits"("address_id");
CREATE INDEX "mtr_visits_status_idx" ON "mtr_visits"("status");
CREATE INDEX "mtr_visits_request_number_idx" ON "mtr_visits"("request_number");
CREATE INDEX "mtr_visit_works_mtr_visit_id_idx" ON "mtr_visit_works"("mtr_visit_id");
CREATE INDEX "mtr_tm_objects_tm_id_idx" ON "mtr_tm_objects"("tm_id");
CREATE INDEX "mtr_tm_objects_address_id_idx" ON "mtr_tm_objects"("address_id");
CREATE INDEX "mtr_tm_engineers_tm_id_idx" ON "mtr_tm_engineers"("tm_id");
CREATE INDEX "mtr_tm_engineers_engineer_id_idx" ON "mtr_tm_engineers"("engineer_id");
CREATE INDEX "photos_mtr_visit_id_idx" ON "photos"("mtr_visit_id");

-- 16. VIEW для администратора (объединение визитов ТО и МТР)
CREATE VIEW "all_visits" AS
SELECT 
    id, 
    user_id AS engineer_id, 
    address_id, 
    date_start,
    status::text AS status, 
    'to' AS visit_type, 
    created_at
FROM visits
UNION ALL
SELECT 
    id, 
    engineer_id, 
    address_id, 
    date_start,
    status::text AS status, 
    'mtr' AS visit_type, 
    created_at
FROM mtr_visits;
