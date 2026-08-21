-- DropForeignKey
ALTER TABLE "equipment_proposals" DROP CONSTRAINT "equipment_proposals_object_equipment_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "object_equipment" DROP CONSTRAINT "object_equipment_created_by_fkey";

-- DropForeignKey
ALTER TABLE "visits" DROP CONSTRAINT "visits_user_id_fkey";

-- AlterTable
ALTER TABLE "equipment_proposals" ALTER COLUMN "pending_until" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "object_equipment" ALTER COLUMN "pending_until" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "external_request_id" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "visit_requests" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "imported_request_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visit_requests_visit_id_idx" ON "visit_requests"("visit_id");

-- CreateIndex
CREATE INDEX "visit_requests_imported_request_id_idx" ON "visit_requests"("imported_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "visit_requests_visit_id_imported_request_id_key" ON "visit_requests"("visit_id", "imported_request_id");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_equipment" ADD CONSTRAINT "object_equipment_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_proposals" ADD CONSTRAINT "equipment_proposals_object_equipment_id_fkey" FOREIGN KEY ("object_equipment_id") REFERENCES "object_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_imported_request_id_fkey" FOREIGN KEY ("imported_request_id") REFERENCES "imported_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
