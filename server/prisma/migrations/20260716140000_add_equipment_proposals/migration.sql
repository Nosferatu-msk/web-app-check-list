-- CreateTable
CREATE TABLE "equipment_proposals" (
    "id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "equipment_type_code" TEXT NOT NULL,
    "room_type_code" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "location_description" TEXT,
    "proposed_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_proposals_address_id_idx" ON "equipment_proposals"("address_id");

-- CreateIndex
CREATE INDEX "equipment_proposals_status_idx" ON "equipment_proposals"("status");

-- AddForeignKey
ALTER TABLE "equipment_proposals" ADD CONSTRAINT "equipment_proposals_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_proposals" ADD CONSTRAINT "equipment_proposals_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_proposals" ADD CONSTRAINT "equipment_proposals_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
