-- Миграция: добавление поля serial_number в таблицу imported_requests
-- Дата: 14.10.2026
-- Описание: Привязка заявок к оборудованию по серийному номеру

-- Добавление поля serial_number
ALTER TABLE "imported_requests" ADD COLUMN "serial_number" TEXT;

-- Индекс для производительности поиска по serial_number
CREATE INDEX "imported_requests_serial_number_idx" ON "imported_requests"("serial_number");
