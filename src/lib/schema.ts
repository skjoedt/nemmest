import { integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

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
	deselectedIngredientIds: text('deselected_ingredient_ids'),
	sortOrder: text('sort_order').notNull().default('default'),
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
	persons: integer('persons').notNull(),
	sortOrder: text('sort_order').notNull(),
	fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
});
