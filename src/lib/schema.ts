import { integer, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';

export const productFavorites = pgTable('product_favorites', {
	id: serial('id').primaryKey(),
	productId: integer('product_id').notNull().unique(),
	addedAt: timestamp('added_at').defaultNow().notNull(),
});
