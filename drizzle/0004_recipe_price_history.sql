CREATE TABLE "recipe_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"price" numeric(8, 2) NOT NULL,
	"persons" integer NOT NULL,
	"sort_order" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_price_history_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe_favorites"("recipe_id") ON DELETE CASCADE
);

-- At most one snapshot per recipe/persons/sort_order per calendar day
CREATE UNIQUE INDEX "recipe_price_history_daily_uq"
	ON "recipe_price_history" ("recipe_id", "persons", "sort_order", (("fetched_at")::date));

-- Fast lookup for graph queries
CREATE INDEX "recipe_price_history_lookup"
	ON "recipe_price_history" ("recipe_id", "persons", "sort_order", "fetched_at" DESC);
