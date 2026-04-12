CREATE TABLE "product_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"brand" text,
	"url" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_favorites_product_id_unique" UNIQUE("product_id")
);

CREATE TABLE "recipe_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"preparation_time" integer,
	"url" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"anchor_product_selection_id" text,
	CONSTRAINT "recipe_favorites_recipe_id_unique" UNIQUE("recipe_id")
);

CREATE TABLE "recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"product_description" text,
	"product_image_url" text,
	"product_url" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" numeric(8, 2) NOT NULL,
	"is_deselected" boolean DEFAULT false NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id")
		REFERENCES "recipe_favorites"("recipe_id") ON DELETE CASCADE
);

CREATE INDEX "recipe_ingredients_recipe_id_idx"
	ON "recipe_ingredients" ("recipe_id", "sort_order");

CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "user_settings_key_unique" UNIQUE("key")
);

CREATE TABLE "recipe_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"price" numeric(8, 2) NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_price_history_recipe_id_fkey" FOREIGN KEY ("recipe_id")
		REFERENCES "recipe_favorites"("recipe_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "recipe_price_history_daily_uq"
	ON "recipe_price_history" ("recipe_id", (("fetched_at")::date));

CREATE INDEX "recipe_price_history_lookup"
	ON "recipe_price_history" ("recipe_id", "fetched_at" DESC);
