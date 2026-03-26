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
