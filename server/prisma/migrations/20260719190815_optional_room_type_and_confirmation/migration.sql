-- AlterTable
ALTER TABLE "object_equipment" ADD COLUMN     "room_confirmed_at" TIMESTAMP(3),
ADD COLUMN     "room_confirmed_by" TEXT,
ALTER COLUMN "room_type_code" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "object_equipment" ADD CONSTRAINT "object_equipment_room_confirmed_by_fkey" FOREIGN KEY ("room_confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
