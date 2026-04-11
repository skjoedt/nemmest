import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { recipeFavorites, recipeIngredients, groupIngredientsByRecipe, toFavoriteRecipe } from '$lib/schema';
import { getSettings } from '$lib/server/settings';

export const load: PageServerLoad = async () => {
	const [favoriteRows, ingredientRows, settings] = await Promise.all([
		db.select().from(recipeFavorites).orderBy(recipeFavorites.addedAt),
		db.select().from(recipeIngredients).orderBy(recipeIngredients.sortOrder),
		getSettings(),
	]);

	const byRecipe = groupIngredientsByRecipe(ingredientRows);
	const favorites = favoriteRows.map((r) => toFavoriteRecipe(r, byRecipe.get(r.recipeId) ?? []));

	return { favorites, settings };
};
