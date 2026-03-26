import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

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
