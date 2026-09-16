-- AlterTable
ALTER TABLE "equipment_proposals" ADD COLUMN "task_id" TEXT;

-- CreateIndex
CREATE INDEX "equipment_proposals_task_id_idx" ON "equipment_proposals"("task_id");

-- AddForeignKey
ALTER TABLE "equipment_proposals" ADD CONSTRAINT "equipment_proposals_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
