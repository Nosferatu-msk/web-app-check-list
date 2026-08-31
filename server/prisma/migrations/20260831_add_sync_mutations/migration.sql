-- CreateTable
CREATE TABLE "sync_mutations" (
    "id" TEXT NOT NULL,
    "client_mutation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "result_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_mutations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_mutations_client_mutation_id_key" ON "sync_mutations"("client_mutation_id");

-- CreateIndex
CREATE INDEX "sync_mutations_user_id_idx" ON "sync_mutations"("user_id");

-- CreateIndex
CREATE INDEX "sync_mutations_created_at_idx" ON "sync_mutations"("created_at");
