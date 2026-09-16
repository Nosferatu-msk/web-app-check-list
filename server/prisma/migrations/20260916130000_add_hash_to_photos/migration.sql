-- AlterTable
ALTER TABLE "photos" ADD COLUMN "hash" TEXT;

-- CreateIndex
CREATE INDEX "photos_hash_idx" ON "photos"("hash");
