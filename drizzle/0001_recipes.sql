CREATE TABLE "recipe_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"preparation_time" integer,
	"url" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_favorites_recipe_id_unique" UNIQUE("recipe_id")
);

CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "user_settings_key_unique" UNIQUE("key")
);
