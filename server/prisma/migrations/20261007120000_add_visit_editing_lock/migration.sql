-- Добавляем поле для отслеживания текущего редактора визита
-- Это нужно для предотвращения одновременного редактирования одним инженером,
-- когда другой инженер уже работает с визитом

ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "editing_engineer_id" TEXT;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "editing_started_at" TIMESTAMP(3);

-- Добавляем индекс для быстрого поиска визитов, которые редактируются
CREATE INDEX IF NOT EXISTS "idx_visits_editing_engineer" ON "visits"("editing_engineer_id") WHERE "editing_engineer_id" IS NOT NULL;

-- Добавляем внешний ключ (опционально, может быть null)
-- Примечание: не добавляем FOREIGN KEY, чтобы избежать проблем при удалении инженера
