CREATE TABLE "tm_team_member" (
    "id" TEXT NOT NULL,
    "member_tm_id" TEXT NOT NULL,
    "lead_tm_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tm_team_member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tm_team_member_member_tm_id_key" ON "tm_team_member"("member_tm_id");
CREATE INDEX "tm_team_member_lead_tm_id_idx" ON "tm_team_member"("lead_tm_id");

ALTER TABLE "tm_team_member" ADD CONSTRAINT "tm_team_member_member_tm_id_fkey" FOREIGN KEY ("member_tm_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tm_team_member" ADD CONSTRAINT "tm_team_member_lead_tm_id_fkey" FOREIGN KEY ("lead_tm_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
