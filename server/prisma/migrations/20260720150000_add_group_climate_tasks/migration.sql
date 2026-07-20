-- AlterTable: tasks — добавление task_type и room_type_code
ALTER TABLE "tasks" ADD COLUMN "task_type" TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE "tasks" ADD COLUMN "room_type_code" TEXT;

-- AlterTable: object_equipment — добавление is_outdoor_unit
ALTER TABLE "object_equipment" ADD COLUMN "is_outdoor_unit" BOOLEAN NOT NULL DEFAULT false;

-- Заполняем is_outdoor_unit для существующих записей
UPDATE "object_equipment" SET "is_outdoor_unit" = true
  WHERE "equipment_type_code" IN ('splitnar', 'mssnar', 'vrv_nar');

-- CreateTable: task_equipment_items
CREATE TABLE "task_equipment_items" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "object_equipment_id" TEXT NOT NULL,
    "status" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_equipment_items_pkey" PRIMARY KEY ("id")
);

-- Индексы для task_equipment_items
CREATE INDEX "task_equipment_items_task_id_idx" ON "task_equipment_items"("task_id");
CREATE UNIQUE INDEX "task_equipment_items_task_id_object_equipment_id_key" ON "task_equipment_items"("task_id", "object_equipment_id");

-- AlterTable: photos — taskId nullable, добавление taskEquipmentItemId
ALTER TABLE "photos" ALTER COLUMN "task_id" DROP NOT NULL;
ALTER TABLE "photos" ADD COLUMN "task_equipment_item_id" TEXT;

-- Индексы для photos (task_equipment_item_id)
CREATE INDEX "photos_task_equipment_item_id_moment_idx" ON "photos"("task_equipment_item_id", "moment");
CREATE UNIQUE INDEX "photos_task_equipment_item_id_moment_key" ON "photos"("task_equipment_item_id", "moment");

-- AddForeignKey: task_equipment_items
ALTER TABLE "task_equipment_items" ADD CONSTRAINT "task_equipment_items_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_equipment_items" ADD CONSTRAINT "task_equipment_items_object_equipment_id_fkey"
    FOREIGN KEY ("object_equipment_id") REFERENCES "object_equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: photos -> task_equipment_items
ALTER TABLE "photos" ADD CONSTRAINT "photos_task_equipment_item_id_fkey"
    FOREIGN KEY ("task_equipment_item_id") REFERENCES "task_equipment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
