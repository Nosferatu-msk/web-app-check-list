-- CreateIndex
ALTER TABLE "object_equipment" ADD CONSTRAINT "object_equipment_address_id_equipment_type_code_serial_key" UNIQUE ("address_id", "equipment_type_code", "serial_number");

-- CreateIndex
ALTER TABLE "object_equipment" ADD CONSTRAINT "object_equipment_address_id_equipment_type_code_location_key" UNIQUE ("address_id", "equipment_type_code", "location_description");
