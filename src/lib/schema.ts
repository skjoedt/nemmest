import { boolean, integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import type { FavoriteIngredient, FavoriteRecipe } from '$lib/types';

export const productFavorites = pgTable('product_favorites', {
	id: serial('id').primaryKey(),
	productId: integer('product_id').notNull().unique(),
	name: text('name').notNull(),
	description: text('description'),
	imageUrl: text('image_url'),
	brand: text('brand'),
	url: text('url'),
	addedAt: timestamp('added_at').defaultNow().notNull(),
});

export const recipeFavorites = pgTable('recipe_favorites', {
	id: serial('id').primaryKey(),
	recipeId: text('recipe_id').notNull().unique(),
	name: text('name').notNull(),
	description: text('description'),
	imageUrl: text('image_url'),
	preparationTime: integer('preparation_time'),
	url: text('url'),
	anchorProductSelectionId: text('anchor_product_selection_id'),
	addedAt: timestamp('added_at').defaultNow().notNull(),
});

export const recipeIngredients = pgTable('recipe_ingredients', {
	id: serial('id').primaryKey(),
	recipeId: text('recipe_id').notNull(),
	productId: text('product_id').notNull(),
	productName: text('product_name').notNull(),
	productDescription: text('product_description'),
	productImageUrl: text('product_image_url'),
	productUrl: text('product_url'),
	quantity: integer('quantity').notNull().default(1),
	price: numeric('price', { precision: 8, scale: 2 }).notNull(),
	isDeselected: boolean('is_deselected').notNull().default(false),
	isCustom: boolean('is_custom').notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
	addedAt: timestamp('added_at').defaultNow().notNull(),
});

export const userSettings = pgTable('user_settings', {
	id: serial('id').primaryKey(),
	key: text('key').notNull().unique(),
	value: text('value').notNull(),
});

export const recipePriceHistory = pgTable('recipe_price_history', {
	id: serial('id').primaryKey(),
	recipeId: text('recipe_id').notNull(),
	price: numeric('price', { precision: 8, scale: 2 }).notNull(),
	fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
});

// ── Row mappers ───────────────────────────────────────────────────────────────

type IngredientRow = typeof recipeIngredients.$inferSelect;
type RecipeFavoriteRow = typeof recipeFavorites.$inferSelect;

export function toFavoriteIngredient(row: IngredientRow): FavoriteIngredient {
	const { addedAt: _, price, ...rest } = row;
	return { ...rest, price: parseFloat(price) };
}

/** Groups ingredient rows by recipeId, applying toFavoriteIngredient. */
export function groupIngredientsByRecipe(
	rows: IngredientRow[],
): Map<string, FavoriteIngredient[]> {
	const map = new Map<string, FavoriteIngredient[]>();
	for (const row of rows) {
		const list = map.get(row.recipeId) ?? [];
		list.push(toFavoriteIngredient(row));
		map.set(row.recipeId, list);
	}
	return map;
}

/** Maps a recipe_favorites row + its ingredients into the API-facing shape. */
export function toFavoriteRecipe(
	row: RecipeFavoriteRow,
	ingredients: FavoriteIngredient[],
): FavoriteRecipe {
	const { id: _, addedAt: __, ...rest } = row;
	return { ...rest, ingredients };
}
