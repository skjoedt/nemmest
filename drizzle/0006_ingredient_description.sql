-- Add product description to recipe_ingredients for display in ingredient rows
ALTER TABLE "recipe_ingredients"
    ADD COLUMN "product_description" text;
