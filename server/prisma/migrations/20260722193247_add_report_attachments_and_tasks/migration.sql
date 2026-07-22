-- CreateTable
CREATE TABLE "report_attachments" (
    "id" TEXT NOT NULL,
    "report_task_id" TEXT,
    "file_path" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "original_name" TEXT,
    "file_size" INTEGER,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_tasks" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "pdf_path" TEXT,
    "photos_zip_path" TEXT,
    "error_message" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "report_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_attachments_report_task_id_idx" ON "report_attachments"("report_task_id");

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_task_id_fkey" FOREIGN KEY ("report_task_id") REFERENCES "report_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_tasks" ADD CONSTRAINT "report_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
