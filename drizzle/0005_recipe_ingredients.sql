-- New table for storing ingredient snapshots per favorite recipe
CREATE TABLE "recipe_ingredients" (
    "id" serial PRIMARY KEY NOT NULL,
    "recipe_id" text NOT NULL,
    "product_id" text NOT NULL,
    "product_name" text NOT NULL,
    "product_image_url" text,
    "product_url" text,
    "quantity" integer NOT NULL DEFAULT 1,
    "price" numeric(8, 2) NOT NULL,
    "is_deselected" boolean NOT NULL DEFAULT false,
    "is_custom" boolean NOT NULL DEFAULT false,
    "sort_order" integer NOT NULL DEFAULT 0,
    "added_at" timestamp DEFAULT now(),
    CONSTRAINT "recipe_ingredients_recipe_id_fkey"
        FOREIGN KEY ("recipe_id") REFERENCES "recipe_favorites"("recipe_id") ON DELETE CASCADE
);

CREATE INDEX "recipe_ingredients_recipe_id_idx"
    ON "recipe_ingredients" ("recipe_id", "sort_order");

-- Add anchor product selection ID to recipe_favorites for AddRecipeToBasket
ALTER TABLE "recipe_favorites"
    ADD COLUMN "anchor_product_selection_id" text;

-- Drop columns superseded by recipe_ingredients table
ALTER TABLE "recipe_favorites"
    DROP COLUMN "deselected_ingredient_ids",
    DROP COLUMN "sort_order";

-- Reset price history — it is ephemeral and will be regenerated.
-- Drop old indexes keyed on persons + sort_order, rebuild on recipe_id + date only.
DELETE FROM "recipe_price_history";

DROP INDEX "recipe_price_history_daily_uq";
DROP INDEX "recipe_price_history_lookup";

ALTER TABLE "recipe_price_history"
    DROP COLUMN "persons",
    DROP COLUMN "sort_order";

CREATE UNIQUE INDEX "recipe_price_history_daily_uq"
    ON "recipe_price_history" ("recipe_id", (("fetched_at")::date));

CREATE INDEX "recipe_price_history_lookup"
    ON "recipe_price_history" ("recipe_id", "fetched_at" DESC);
