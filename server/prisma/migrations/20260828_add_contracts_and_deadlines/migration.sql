-- Создание enum типов (идемпотентно)
DO $$ BEGIN
    CREATE TYPE "RequestType" AS ENUM ('planned', 'unplanned');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ContractModule" AS ENUM ('to', 'mtr');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Таблица договоров
CREATE TABLE IF NOT EXISTS "contracts" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "tm_id" TEXT NOT NULL,
    "module" "ContractModule" NOT NULL DEFAULT 'to',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- Таблица настроек сроков заявок
CREATE TABLE IF NOT EXISTS "request_deadline_settings" (
    "id" TEXT NOT NULL,
    "request_type" "RequestType" NOT NULL,
    "deadline_days" INTEGER,
    "notification_days_before" INTEGER NOT NULL DEFAULT 5,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "request_deadline_settings_pkey" PRIMARY KEY ("id")
);

-- Новые поля (идемпотентно)
DO $$ BEGIN
    ALTER TABLE "tm_objects" ADD COLUMN "contract_id" TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "imported_requests" ADD COLUMN "contract_id" TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "imported_requests" ADD COLUMN "request_type" "RequestType";
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "imported_requests" ADD COLUMN "start_date" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "imported_requests" ADD COLUMN "deadline" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "visits" ADD COLUMN "contract_id" TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "mtr_tm_objects" ADD COLUMN "contract_id" TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "mtr_visits" ADD COLUMN "contract_id" TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Индексы
CREATE INDEX IF NOT EXISTS "contracts_tm_id_idx" ON "contracts"("tm_id");
CREATE INDEX IF NOT EXISTS "contracts_number_idx" ON "contracts"("number");
CREATE UNIQUE INDEX IF NOT EXISTS "contracts_number_tm_id_module_key" ON "contracts"("number", "tm_id", "module");
CREATE UNIQUE INDEX IF NOT EXISTS "request_deadline_settings_request_type_key" ON "request_deadline_settings"("request_type");
CREATE INDEX IF NOT EXISTS "tm_objects_contract_id_idx" ON "tm_objects"("contract_id");
CREATE INDEX IF NOT EXISTS "imported_requests_contract_id_idx" ON "imported_requests"("contract_id");
CREATE INDEX IF NOT EXISTS "visits_contract_id_idx" ON "visits"("contract_id");
CREATE INDEX IF NOT EXISTS "mtr_tm_objects_contract_id_idx" ON "mtr_tm_objects"("contract_id");
CREATE INDEX IF NOT EXISTS "mtr_visits_contract_id_idx" ON "mtr_visits"("contract_id");

-- Внешние ключи (идемпотентно)
DO $$ BEGIN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tm_id_fkey"
        FOREIGN KEY ("tm_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "request_deadline_settings" ADD CONSTRAINT "request_deadline_settings_updated_by_fkey"
        FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "tm_objects" ADD CONSTRAINT "tm_objects_contract_id_fkey"
        FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "imported_requests" ADD CONSTRAINT "imported_requests_contract_id_fkey"
        FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "visits" ADD CONSTRAINT "visits_contract_id_fkey"
        FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "mtr_tm_objects" ADD CONSTRAINT "mtr_tm_objects_contract_id_fkey"
        FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "mtr_visits" ADD CONSTRAINT "mtr_visits_contract_id_fkey"
        FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Изменение уникального индекса tm_objects (drop old, create new)
ALTER TABLE "tm_objects" DROP CONSTRAINT IF EXISTS "tm_objects_tm_id_address_id_key";
DROP INDEX IF EXISTS "tm_objects_tm_id_address_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "tm_objects_tm_id_address_id_contract_id_key" ON "tm_objects"("tm_id", "address_id", "contract_id");

-- Изменение уникального индекса mtr_tm_objects
ALTER TABLE "mtr_tm_objects" DROP CONSTRAINT IF EXISTS "mtr_tm_objects_tm_id_address_id_key";
DROP INDEX IF EXISTS "mtr_tm_objects_tm_id_address_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "mtr_tm_objects_tm_id_address_id_contract_id_key" ON "mtr_tm_objects"("tm_id", "address_id", "contract_id");

-- Seed настроек сроков по умолчанию (идемпотентно)
INSERT INTO "request_deadline_settings" ("id", "request_type", "deadline_days", "notification_days_before", "updated_by", "updated_at")
SELECT gen_random_uuid()::text, 'planned'::"RequestType", NULL, 5, (SELECT id FROM users WHERE role = 'admin' LIMIT 1), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "request_deadline_settings" WHERE "request_type" = 'planned');

INSERT INTO "request_deadline_settings" ("id", "request_type", "deadline_days", "notification_days_before", "updated_by", "updated_at")
SELECT gen_random_uuid()::text, 'unplanned'::"RequestType", 14, 5, (SELECT id FROM users WHERE role = 'admin' LIMIT 1), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "request_deadline_settings" WHERE "request_type" = 'unplanned');

-- Seed договоров для существующих ТМ (идемпотентно)
INSERT INTO "contracts" ("id", "number", "tm_id", "module", "is_active", "created_at")
SELECT gen_random_uuid()::text, '050005596590', 'b9758bf8-cf33-4d13-a741-edbb4d55748f', 'to', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "contracts" WHERE "number" = '050005596590' AND "tm_id" = 'b9758bf8-cf33-4d13-a741-edbb4d55748f');

INSERT INTO "contracts" ("id", "number", "tm_id", "module", "is_active", "created_at")
SELECT gen_random_uuid()::text, '050001234567', '955f520b-41f4-4236-9ecf-e11365c81824', 'to', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "contracts" WHERE "number" = '050001234567' AND "tm_id" = '955f520b-41f4-4236-9ecf-e11365c81824');

INSERT INTO "contracts" ("id", "number", "tm_id", "module", "is_active", "created_at")
SELECT gen_random_uuid()::text, '050000987654', '8d0d86bc-ff3c-4c89-9383-530ed8e044f0', 'to', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "contracts" WHERE "number" = '050000987654' AND "tm_id" = '8d0d86bc-ff3c-4c89-9383-530ed8e044f0');

INSERT INTO "contracts" ("id", "number", "tm_id", "module", "is_active", "created_at")
SELECT gen_random_uuid()::text, '050009876540', '7b203951-263f-442d-8d0a-2bc73ea17745', 'mtr', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "contracts" WHERE "number" = '050009876540' AND "tm_id" = '7b203951-263f-442d-8d0a-2bc73ea17745' AND "module" = 'mtr');

-- Привязка существующих объектов к договорам
UPDATE "tm_objects" SET "contract_id" = (
    SELECT c."id" FROM "contracts" c
    WHERE c."tm_id" = "tm_objects"."tm_id" AND c."module" = 'to'
    LIMIT 1
) WHERE "contract_id" IS NULL;

UPDATE "mtr_tm_objects" SET "contract_id" = (
    SELECT c."id" FROM "contracts" c
    WHERE c."tm_id" = "mtr_tm_objects"."tm_id" AND c."module" = 'mtr'
    LIMIT 1
) WHERE "contract_id" IS NULL;

-- Привязка существующих заявок к договорам (все заявки — плановые за август 2026)
UPDATE "imported_requests" SET
    "contract_id" = (
        SELECT c."id" FROM "contracts" c
        JOIN "tm_objects" tmo ON tmo."address_id" = "imported_requests"."matched_address_id"
        WHERE c."tm_id" = tmo."tm_id" AND c."module" = 'to'
        LIMIT 1
    ),
    "request_type" = 'planned',
    "start_date" = '2026-08-01'::timestamp,
    "deadline" = '2026-08-31'::timestamp
WHERE "contract_id" IS NULL;

-- Привязка визитов к договорам через заявки
UPDATE "visits" SET "contract_id" = (
    SELECT ir."contract_id" FROM "imported_requests" ir
    JOIN "visit_requests" vr ON vr."imported_request_id" = ir."id"
    WHERE vr."visit_id" = "visits"."id"
    LIMIT 1
)
WHERE "contract_id" IS NULL AND "is_deleted" = false;
