/*
  Warnings:

  - The primary key for the `user_favorite_objects` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "user_favorite_objects" DROP CONSTRAINT "user_favorite_objects_object_code_fkey";

-- AlterTable
ALTER TABLE "object_equipment" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "object_equipment_id" TEXT;

-- AlterTable
ALTER TABLE "user_favorite_objects" DROP CONSTRAINT "user_favorite_objects_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "object_code" SET DATA TYPE TEXT,
ALTER COLUMN "added_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "user_favorite_objects_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_object_equipment_id_fkey" FOREIGN KEY ("object_equipment_id") REFERENCES "object_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite_objects" ADD CONSTRAINT "user_favorite_objects_object_code_fkey" FOREIGN KEY ("object_code") REFERENCES "addresses"("object_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "object_equipment_address_id_equipment_type_code_location_key" RENAME TO "object_equipment_address_id_equipment_type_code_location_de_key";

-- RenameIndex
ALTER INDEX "object_equipment_address_id_equipment_type_code_serial_key" RENAME TO "object_equipment_address_id_equipment_type_code_serial_numb_key";
