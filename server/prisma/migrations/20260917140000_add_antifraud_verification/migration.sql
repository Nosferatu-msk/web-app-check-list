-- Антифрод-система верификации фото

-- Координаты адресов для GPS-проверки
ALTER TABLE "addresses" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "addresses" ADD COLUMN "longitude" DOUBLE PRECISION;

-- Новые поля в таблице photos
ALTER TABLE "photos" ADD COLUMN "phash" TEXT;
ALTER TABLE "photos" ADD COLUMN "captured_at" TIMESTAMP(3);
ALTER TABLE "photos" ADD COLUMN "gps_lat" DOUBLE PRECISION;
ALTER TABLE "photos" ADD COLUMN "gps_lng" DOUBLE PRECISION;
ALTER TABLE "photos" ADD COLUMN "photo_source" TEXT;
ALTER TABLE "photos" ADD COLUMN "verification_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "photos" ADD COLUMN "verification_details" JSONB;

CREATE INDEX "photos_verification_status_idx" ON "photos"("verification_status");

-- Таблица отклонений верификации
CREATE TABLE "visit_anomalies" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "photo_id" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "details" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_anomalies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visit_anomalies_visit_id_idx" ON "visit_anomalies"("visit_id");
CREATE INDEX "visit_anomalies_type_idx" ON "visit_anomalies"("type");
CREATE INDEX "visit_anomalies_status_idx" ON "visit_anomalies"("status");
CREATE INDEX "visit_anomalies_visit_id_status_idx" ON "visit_anomalies"("visit_id", "status");

-- Foreign keys
ALTER TABLE "visit_anomalies" ADD CONSTRAINT "visit_anomalies_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visit_anomalies" ADD CONSTRAINT "visit_anomalies_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "visit_anomalies" ADD CONSTRAINT "visit_anomalies_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
