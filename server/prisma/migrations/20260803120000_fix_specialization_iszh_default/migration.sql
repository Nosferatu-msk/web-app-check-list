-- AlterTable: изменить default для specialization_iszh с true на false
ALTER TABLE "users" ALTER COLUMN "specialization_iszh" SET DEFAULT false;
