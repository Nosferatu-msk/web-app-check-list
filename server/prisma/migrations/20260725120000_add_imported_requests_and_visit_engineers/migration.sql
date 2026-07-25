-- AlterEnum: добавить awaiting_assignment в VisitStatus
ALTER TYPE "VisitStatus" ADD VALUE 'awaiting_assignment';

-- AlterTable: расширение visits
ALTER TABLE "visits"
  ADD COLUMN "is_multi_specialist" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: userId становится nullable
ALTER TABLE "visits" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable: engineerName получает дефолт (для визитов без инженера)
ALTER TABLE "visits" ALTER COLUMN "engineer_name" SET DEFAULT '';

-- AlterTable: расширение tasks
ALTER TABLE "tasks" ADD COLUMN "external_request_id" VARCHAR(100);

-- CreateTable: imported_requests
CREATE TABLE "imported_requests" (
    "id" TEXT NOT NULL,
    "external_request_id" TEXT NOT NULL,
    "external_status" TEXT,
    "equipment_type_id" TEXT NOT NULL,
    "equipment_type_code" TEXT,
    "object_code" TEXT NOT NULL,
    "address_raw" TEXT,
    "matched_address_id" TEXT,
    "visit_id" TEXT,
    "import_status" TEXT NOT NULL DEFAULT 'new',
    "error_message" TEXT,
    "imported_by" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imported_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: visit_engineers
CREATE TABLE "visit_engineers" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "engineer_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_engineers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: request_assignment_log
CREATE TABLE "request_assignment_log" (
    "id" TEXT NOT NULL,
    "imported_request_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "engineer_id" TEXT,
    "performed_by" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_assignment_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imported_requests_external_request_id_key" ON "imported_requests"("external_request_id");
CREATE INDEX "imported_requests_import_status_idx" ON "imported_requests"("import_status");
CREATE INDEX "imported_requests_object_code_idx" ON "imported_requests"("object_code");
CREATE INDEX "imported_requests_visit_id_idx" ON "imported_requests"("visit_id");

CREATE UNIQUE INDEX "visit_engineers_visit_id_engineer_id_key" ON "visit_engineers"("visit_id", "engineer_id");
CREATE INDEX "visit_engineers_visit_id_idx" ON "visit_engineers"("visit_id");
CREATE INDEX "visit_engineers_engineer_id_idx" ON "visit_engineers"("engineer_id");

CREATE INDEX "request_assignment_log_imported_request_id_idx" ON "request_assignment_log"("imported_request_id");
CREATE INDEX "request_assignment_log_created_at_idx" ON "request_assignment_log"("created_at");

-- AddForeignKey
ALTER TABLE "imported_requests" ADD CONSTRAINT "imported_requests_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "imported_requests" ADD CONSTRAINT "imported_requests_matched_address_id_fkey" FOREIGN KEY ("matched_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "imported_requests" ADD CONSTRAINT "imported_requests_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "imported_requests" ADD CONSTRAINT "imported_requests_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "visit_engineers" ADD CONSTRAINT "visit_engineers_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visit_engineers" ADD CONSTRAINT "visit_engineers_engineer_id_fkey" FOREIGN KEY ("engineer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visit_engineers" ADD CONSTRAINT "visit_engineers_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "request_assignment_log" ADD CONSTRAINT "request_assignment_log_imported_request_id_fkey" FOREIGN KEY ("imported_request_id") REFERENCES "imported_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "request_assignment_log" ADD CONSTRAINT "request_assignment_log_engineer_id_fkey" FOREIGN KEY ("engineer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "request_assignment_log" ADD CONSTRAINT "request_assignment_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
