import { db } from '$lib/db';
import { recipeFavorites, recipePriceHistory } from '$lib/schema';
import { NEMLIG_BASE_URL, NEMLIG_STATIC_HEADERS } from '$lib/nemlig';
import { logger } from '$lib/logger';
import { parseSortOrder, type RecipeSortOrder } from '$lib/types';
import { getSettings, parsePersonsSetting } from '$lib/settings';

const log = logger.withTag('worker:recipe-prices');

// Minimal shape from GetProductSelections — only the fields needed for price summing.
interface RawProductSelection {
	IsSupplementProduct: boolean;
	Product: { PriceForCurrentRecipe: number } | null;
}

interface RawGetProductSelectionsResponse {
	Products?: RawProductSelection[];
}

// Returns null on any network or parse error so the caller can skip gracefully.
async function fetchRecipeTotal(
	recipeId: string,
	sortOrder: RecipeSortOrder,
	persons: number,
): Promise<number | null> {
	const url = new URL(`${NEMLIG_BASE_URL}/x/x/1/1/Recipe/GetProductSelections`);
	url.searchParams.set('recipeId', recipeId);
	url.searchParams.set('sortorder', sortOrder);
	url.searchParams.set('personsAmount', String(persons));

	let data: RawGetProductSelectionsResponse;
	try {
		const res = await fetch(url.toString(), {
			headers: { ...NEMLIG_STATIC_HEADERS, 'x-correlation-id': crypto.randomUUID() },
		});
		if (!res.ok) {
			log.error(`Upstream error ${res.status} for recipeId=${recipeId}`);
			return null;
		}
		data = (await res.json()) as RawGetProductSelectionsResponse;
	} catch (e) {
		log.error(`Failed to fetch recipeId=${recipeId}:`, e);
		return null;
	}

	return (data.Products ?? [])
		.filter((p) => !p.IsSupplementProduct && p.Product !== null)
		.reduce((sum, p) => sum + p.Product!.PriceForCurrentRecipe, 0);
}

// Inserts one row per recipe per day; duplicate runs are idempotent via the
// unique index on (recipe_id, persons, sort_order, fetched_at::date).
export async function fetchRecipePrices(): Promise<void> {
	log.info('Starting daily recipe price fetch');

	const [favoriteRows, settings] = await Promise.all([
		db.select().from(recipeFavorites),
		getSettings(),
	]);

	if (favoriteRows.length === 0) {
		log.info('No favorite recipes — nothing to fetch');
		return;
	}

	const persons = parsePersonsSetting(settings);
	log.info(`Fetching prices for ${favoriteRows.length} recipes at persons=${persons}`);

	let succeeded = 0;
	let skipped = 0;
	let failed = 0;

	for (const recipe of favoriteRows) {
		const sortOrder = parseSortOrder(recipe.sortOrder);

		log.debug(`Fetching recipeId=${recipe.recipeId} sortOrder=${sortOrder} persons=${persons}`);

		const total = await fetchRecipeTotal(recipe.recipeId, sortOrder, persons);

		if (total === null) {
			log.warn(`Skipping recipeId=${recipe.recipeId} — fetch failed`);
			failed++;
			continue;
		}

		const result = await db
			.insert(recipePriceHistory)
			.values({ recipeId: recipe.recipeId, price: total.toFixed(2), persons, sortOrder })
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

	log.info(`Done — ${succeeded} recorded, ${skipped} already existed today, ${failed} failed`);
}
