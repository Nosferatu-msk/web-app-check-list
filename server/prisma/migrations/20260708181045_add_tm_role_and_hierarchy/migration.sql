-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'tm';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VisitStatus" ADD VALUE 'planned';
ALTER TYPE "VisitStatus" ADD VALUE 'not_started';
ALTER TYPE "VisitStatus" ADD VALUE 'sent_by_engineer';
ALTER TYPE "VisitStatus" ADD VALUE 'sent_by_tm';
ALTER TYPE "VisitStatus" ADD VALUE 'corrected_by_tm';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "assigned_at" TIMESTAMP(3),
ADD COLUMN     "assigned_by_id" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sent_by_engineer_at" TIMESTAMP(3),
ADD COLUMN     "sent_by_tm_at" TIMESTAMP(3),
ADD COLUMN     "tm_corrected" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'not_started';

-- CreateTable
CREATE TABLE "tm_objects" (
    "id" TEXT NOT NULL,
    "tm_id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tm_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tm_engineers" (
    "id" TEXT NOT NULL,
    "tm_id" TEXT NOT NULL,
    "engineer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tm_engineers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "success_rows" INTEGER NOT NULL,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL,
    "errors" JSONB,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tm_objects_tm_id_idx" ON "tm_objects"("tm_id");

-- CreateIndex
CREATE INDEX "tm_objects_address_id_idx" ON "tm_objects"("address_id");

-- CreateIndex
CREATE UNIQUE INDEX "tm_objects_tm_id_address_id_key" ON "tm_objects"("tm_id", "address_id");

-- CreateIndex
CREATE INDEX "tm_engineers_tm_id_idx" ON "tm_engineers"("tm_id");

-- CreateIndex
CREATE INDEX "tm_engineers_engineer_id_idx" ON "tm_engineers"("engineer_id");

-- CreateIndex
CREATE UNIQUE INDEX "tm_engineers_engineer_id_key" ON "tm_engineers"("engineer_id");

-- CreateIndex
CREATE INDEX "import_logs_user_id_created_at_idx" ON "import_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "import_logs_entity_type_idx" ON "import_logs"("entity_type");

-- CreateIndex
CREATE INDEX "visits_assigned_by_id_idx" ON "visits"("assigned_by_id");

-- CreateIndex
CREATE INDEX "visits_is_deleted_idx" ON "visits"("is_deleted");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tm_objects" ADD CONSTRAINT "tm_objects_tm_id_fkey" FOREIGN KEY ("tm_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tm_objects" ADD CONSTRAINT "tm_objects_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tm_engineers" ADD CONSTRAINT "tm_engineers_tm_id_fkey" FOREIGN KEY ("tm_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tm_engineers" ADD CONSTRAINT "tm_engineers_engineer_id_fkey" FOREIGN KEY ("engineer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
