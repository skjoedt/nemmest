import { db } from '$lib/db';
import { recipeFavorites, recipeIngredients, recipePriceHistory } from '$lib/schema';
import { logger } from '$lib/logger';
import { fetchProductPrice } from '$lib/nemlig';

const log = logger.withTag('worker:recipe-prices');

const FETCH_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchRecipePrices(): Promise<void> {
	log.info('Starting daily recipe price fetch');

	const favoriteRows = await db.select().from(recipeFavorites);

	if (favoriteRows.length === 0) {
		log.info('No favorite recipes — nothing to fetch');
		return;
	}

	// Load all active (non-deselected) ingredients, grouped by recipe
	const allIngredients = await db.select().from(recipeIngredients);
	const ingredientsByRecipe = new Map<string, typeof allIngredients>();
	for (const i of allIngredients) {
		if (i.isDeselected) continue;
		const list = ingredientsByRecipe.get(i.recipeId) ?? [];
		list.push(i);
		ingredientsByRecipe.set(i.recipeId, list);
	}

	log.info(`Fetching prices for ${favoriteRows.length} recipes`);

	let succeeded = 0;
	let skipped = 0;

	for (const recipe of favoriteRows) {
		const ingredients = ingredientsByRecipe.get(recipe.recipeId) ?? [];

		if (ingredients.length === 0) {
			log.warn(`recipeId=${recipe.recipeId} — no active ingredients, skipping`);
			skipped++;
			continue;
		}

		log.debug(`recipeId=${recipe.recipeId} — fetching ${ingredients.length} ingredient prices`);

		let total = 0;
		let fetchFailed = false;

		for (const ing of ingredients) {
			if (!ing.productUrl) {
				log.warn(`ingredient id=${ing.id} has no productUrl, using stored price`);
				total += parseFloat(ing.price) * ing.quantity;
				fetchFailed = true;
				continue;
			}

			await sleep(FETCH_DELAY_MS);

			const price = await fetchProductPrice(ing.productUrl);
			if (price === null) {
				log.warn(`ingredient id=${ing.id} productUrl=${ing.productUrl} — price fetch failed, using stored price`);
				total += parseFloat(ing.price) * ing.quantity;
				fetchFailed = true;
			} else {
				total += price * ing.quantity;
			}
		}

		if (fetchFailed) {
			log.warn(`recipeId=${recipe.recipeId} — using partial prices`);
		}

		const result = await db
			.insert(recipePriceHistory)
			.values({ recipeId: recipe.recipeId, price: total.toFixed(2) })
			.onConflictDoNothing()
			.returning({ id: recipePriceHistory.id });

		if (result.length === 0) {
			log.debug(`recipeId=${recipe.recipeId} — already recorded today, skipping`);
			skipped++;
		} else {
			log.info(`recipeId=${recipe.recipeId} price=${total.toFixed(2)} recorded`);
			succeeded++;
		}
	}

	log.info(`Done — ${succeeded} recorded, ${skipped} skipped`);
}
