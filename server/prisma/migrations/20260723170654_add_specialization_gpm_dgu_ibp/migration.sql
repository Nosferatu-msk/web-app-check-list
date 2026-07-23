-- AlterTable
ALTER TABLE "users" ADD COLUMN     "specialization_dgu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specialization_gpm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specialization_ibp" BOOLEAN NOT NULL DEFAULT false;
