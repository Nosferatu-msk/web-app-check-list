-- Add specialization fields to users
ALTER TABLE "users" ADD COLUMN "specialization_vik" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "specialization_iszh" BOOLEAN NOT NULL DEFAULT true;

-- Create user_favorite_objects table
CREATE TABLE "user_favorite_objects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "object_code" VARCHAR(50) NOT NULL,
  "added_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_favorite_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_favorite_objects_user_id_object_code_key" ON "user_favorite_objects"("user_id", "object_code");
CREATE INDEX "user_favorite_objects_user_id_idx" ON "user_favorite_objects"("user_id");

ALTER TABLE "user_favorite_objects" ADD CONSTRAINT "user_favorite_objects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_favorite_objects" ADD CONSTRAINT "user_favorite_objects_object_code_fkey" FOREIGN KEY ("object_code") REFERENCES "addresses"("object_code") ON DELETE CASCADE ON UPDATE CASCADE;
