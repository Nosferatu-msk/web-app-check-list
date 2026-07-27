-- AlterTable: add is_deleted to notifications
ALTER TABLE "notifications" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- Drop old index and create new composite index
DROP INDEX IF EXISTS "notifications_user_id_is_read_idx";
CREATE INDEX "notifications_user_id_is_deleted_is_read_idx" ON "notifications"("user_id", "is_deleted", "is_read");

-- CreateTable: system_releases
CREATE TABLE "system_releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "release_notes" TEXT NOT NULL,
    "deployed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployed_by" TEXT NOT NULL,
    "admin_id" TEXT,
    "notification_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "system_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_releases_version_key" ON "system_releases"("version");
CREATE INDEX "system_releases_deployed_at_idx" ON "system_releases"("deployed_at");

-- AddForeignKey
ALTER TABLE "system_releases" ADD CONSTRAINT "system_releases_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
