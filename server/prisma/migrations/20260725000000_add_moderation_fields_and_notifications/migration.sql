-- AlterTable: equipment_proposals — расширенные поля модерации
ALTER TABLE "equipment_proposals"
  ADD COLUMN "request_type" VARCHAR(20) NOT NULL DEFAULT 'new_equipment',
  ADD COLUMN "old_room_type_code" VARCHAR(50),
  ADD COLUMN "rejection_reason" TEXT,
  ADD COLUMN "pending_until" TIMESTAMP,
  ADD COLUMN "object_equipment_id" UUID;

-- AlterTable: object_equipment — поля модерации и TTL
ALTER TABLE "object_equipment"
  ADD COLUMN "confirmation_status" VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  ADD COLUMN "created_by" UUID,
  ADD COLUMN "pending_until" TIMESTAMP;

-- CreateTable: notifications
CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" VARCHAR(30) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "message" TEXT NOT NULL,
  "entity_type" VARCHAR(30),
  "entity_id" UUID,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: equipment_proposals -> object_equipment
ALTER TABLE "equipment_proposals"
  ADD CONSTRAINT "equipment_proposals_object_equipment_id_fkey"
  FOREIGN KEY ("object_equipment_id") REFERENCES "object_equipment"("id") ON DELETE SET NULL;

-- AddForeignKey: object_equipment -> users (created_by)
ALTER TABLE "object_equipment"
  ADD CONSTRAINT "object_equipment_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;

-- AddForeignKey: notifications -> users
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- CreateIndex
CREATE INDEX "equipment_proposals_request_type_idx" ON "equipment_proposals"("request_type");
CREATE INDEX "equipment_proposals_pending_until_idx" ON "equipment_proposals"("pending_until");
CREATE INDEX "equipment_proposals_object_equipment_id_status_idx" ON "equipment_proposals"("object_equipment_id", "status");
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");
