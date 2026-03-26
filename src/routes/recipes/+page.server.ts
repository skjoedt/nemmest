import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { recipeFavorites, userSettings } from '$lib/schema';
import type { FavoriteRecipe, RecipeSortOrder } from '$lib/types';
import { VALID_SORT_ORDERS } from '$lib/types';
import { decodeIds } from '$lib/recipe-utils';

export const load: PageServerLoad = async () => {
	const [favoriteRows, settingRows] = await Promise.all([
		db.select().from(recipeFavorites).orderBy(recipeFavorites.addedAt),
		db.select().from(userSettings),
	]);

	const favorites: FavoriteRecipe[] = favoriteRows.map((r) => ({
		recipeId: r.recipeId,
		name: r.name,
		description: r.description,
		imageUrl: r.imageUrl,
		preparationTime: r.preparationTime,
		url: r.url,
		sortOrder: (VALID_SORT_ORDERS.has(r.sortOrder as RecipeSortOrder)
			? r.sortOrder
			: 'default') as RecipeSortOrder,
		deselectedIngredientIds: decodeIds(r.deselectedIngredientIds),
	}));

	const settingsMap: Record<string, string> = {};
	for (const row of settingRows) {
		settingsMap[row.key] = row.value;
	}

	return { favorites, settings: settingsMap };
};
