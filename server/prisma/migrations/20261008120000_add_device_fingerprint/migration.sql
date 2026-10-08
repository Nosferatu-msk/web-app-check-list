-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN "device_fingerprint" TEXT;

-- CreateIndex
CREATE INDEX "audit_log_device_fingerprint_idx" ON "audit_log"("device_fingerprint");
