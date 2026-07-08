-- AlterTable
ALTER TABLE "addresses" ADD COLUMN "object_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "addresses_object_code_key" ON "addresses"("object_code");

-- CreateTable
CREATE TABLE "object_equipment" (
    "id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "equipment_type_code" TEXT NOT NULL,
    "room_type_code" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "location_description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "object_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "object_equipment_address_id_idx" ON "object_equipment"("address_id");

-- CreateIndex
CREATE INDEX "object_equipment_equipment_type_code_idx" ON "object_equipment"("equipment_type_code");

-- AddForeignKey
ALTER TABLE "object_equipment" ADD CONSTRAINT "object_equipment_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
