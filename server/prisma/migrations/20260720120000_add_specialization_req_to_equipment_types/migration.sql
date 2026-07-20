-- AlterTable
ALTER TABLE "equipment_types" ADD COLUMN "specialization_req" TEXT;

-- Заполняем specialization_req для существующих записей
UPDATE "equipment_types" SET "specialization_req" = 'vik'
  WHERE "code" IN ('vent', 'vrv_vn', 'vrv_nar', 'mssvn', 'mssnar', 'splitvn', 'splitnar');

UPDATE "equipment_types" SET "specialization_req" = 'iszh'
  WHERE "code" IN ('rsch', 'schetchik_gvs', 'schetchik_hvs', 'schetchik_electroshc', 'seti_vodosnab', 'teplovye_seti');
