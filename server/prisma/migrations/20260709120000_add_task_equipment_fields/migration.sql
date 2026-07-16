-- AlterTable: rename location to comment
ALTER TABLE "tasks" RENAME COLUMN "location" TO "comment";

-- AlterTable: add equipment detail fields
ALTER TABLE "tasks" ADD COLUMN "brand" TEXT;
ALTER TABLE "tasks" ADD COLUMN "model" TEXT;
ALTER TABLE "tasks" ADD COLUMN "serial_number" TEXT;
