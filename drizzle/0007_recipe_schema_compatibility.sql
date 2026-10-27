ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "product_selection_id" text;
ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "product_selection_name" text;
ALTER TABLE "recipe_favorites" ADD COLUMN IF NOT EXISTS "persons" integer DEFAULT 4 NOT NULL;
ALTER TABLE "recipe_favorites" ADD COLUMN IF NOT EXISTS "sort_order" text DEFAULT 'default' NOT NULL;
