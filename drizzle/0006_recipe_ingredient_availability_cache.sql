ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "availability_status" text DEFAULT 'unknown' NOT NULL;
ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "availability_checked_at" timestamp;
ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "availability_retry_after" timestamp;
ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "availability_lease_until" timestamp;
UPDATE "recipe_ingredients"
SET "availability_status" = CASE WHEN "is_unavailable" THEN 'unavailable' ELSE 'unknown' END;
