CREATE TABLE "product_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_favorites_product_id_unique" UNIQUE("product_id")
);
