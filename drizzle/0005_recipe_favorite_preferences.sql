ALTER TABLE "recipe_favorites" ADD COLUMN IF NOT EXISTS "persons" integer DEFAULT 4 NOT NULL;
ALTER TABLE "recipe_favorites" ADD COLUMN IF NOT EXISTS "sort_order" text DEFAULT 'default' NOT NULL;
