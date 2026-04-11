import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { recipeFavorites, recipeIngredients, recipePriceHistory, groupIngredientsByRecipe, toFavoriteRecipe, toFavoriteIngredient } from '$lib/schema';
import { eq } from 'drizzle-orm';
import { parseSortOrder } from '$lib/types';
import { fetchProductSelections, type RawProductSelection } from '$lib/nemlig';
import { logger } from '$lib/logger';

const log = logger.withTag('recipes/favorites');

export const GET: RequestHandler = async () => {
	const [rows, ingredientRows] = await Promise.all([
		db.select().from(recipeFavorites).orderBy(recipeFavorites.addedAt),
		db.select().from(recipeIngredients).orderBy(recipeIngredients.sortOrder),
	]);

	const byRecipe = groupIngredientsByRecipe(ingredientRows);
	return json(rows.map((r) => toFavoriteRecipe(r, byRecipe.get(r.recipeId) ?? [])));
};

// POST /api/recipes/favorites — favorite a recipe, snapshot its ingredients
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null) as {
		recipeId?: unknown;
		name?: unknown;
		description?: unknown;
		imageUrl?: unknown;
		preparationTime?: unknown;
		url?: unknown;
		sortOrder?: unknown;
		persons?: unknown;
	} | null;

	if (typeof body?.recipeId !== 'string' || !body.recipeId.trim()) {
		return json({ error: 'recipeId (string) is required' }, { status: 400 });
	}
	if (typeof body?.name !== 'string' || !body.name.trim()) {
		return json({ error: 'name (string) is required' }, { status: 400 });
	}

	const recipeId = body.recipeId.trim();
	const sortOrder = parseSortOrder(typeof body.sortOrder === 'string' ? body.sortOrder : null);
	const parsedPersons = typeof body.persons === 'number' ? body.persons : 4;
	const persons = Math.min(10, Math.max(1, isNaN(parsedPersons) ? 4 : parsedPersons));

	log.info(`Favoriting recipeId=${recipeId} sortOrder=${sortOrder} persons=${persons}`);

	let selections: RawProductSelection[];
	try {
		selections = await fetchProductSelections(recipeId, sortOrder, persons);
	} catch (e) {
		log.error(`Failed to fetch product selections for recipeId=${recipeId}:`, e);
		return json({ error: 'Could not fetch recipe ingredients from nemlig.com' }, { status: 502 });
	}

	const nonSupplementSelections = selections.filter((s) => !s.IsSupplementProduct);
	const anchorProductSelectionId = nonSupplementSelections[0]?.ProductSelectionId ?? null;

	const recipeValues = {
		recipeId,
		name: body.name.trim(),
		description: typeof body.description === 'string' ? body.description : null,
		imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
		preparationTime: typeof body.preparationTime === 'number' ? body.preparationTime : null,
		url: typeof body.url === 'string' ? body.url : null,
		anchorProductSelectionId,
	};

	const [favoriteRow] = await db
		.insert(recipeFavorites)
		.values(recipeValues)
		.onConflictDoUpdate({ target: recipeFavorites.recipeId, set: recipeValues })
		.returning();

	// Delete existing ingredients and price history, then insert fresh snapshot
	await Promise.all([
		db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId)),
		db.delete(recipePriceHistory).where(eq(recipePriceHistory.recipeId, recipeId)),
	]);

	const ingredientValues = selections.map((sel, idx) => ({
		recipeId,
		productId: sel.Product!.Id,
		productName: sel.Product!.Name,
		productDescription: sel.Product!.Description ?? null,
		productImageUrl: sel.Product!.PrimaryImage ?? null,
		productUrl: sel.Product!.Url ? `https://www.nemlig.com/${sel.Product!.Url}` : null,
		quantity: sel.Product!.AmountForCurrentRecipe,
		price: sel.Product!.PriceForCurrentRecipe.toFixed(2),
		isDeselected: sel.IsSupplementProduct,
		isCustom: false,
		sortOrder: idx,
	}));

	let ingredientRows: typeof recipeIngredients.$inferSelect[] = [];
	if (ingredientValues.length > 0) {
		ingredientRows = await db
			.insert(recipeIngredients)
			.values(ingredientValues)
			.returning();
	}

	return json(
		toFavoriteRecipe(favoriteRow, ingredientRows.map(toFavoriteIngredient)),
		{ status: 201 },
	);
};

export const DELETE: RequestHandler = async ({ url }) => {
	const recipeId = url.searchParams.get('id');
	if (!recipeId) return json({ error: 'id (recipeId) query parameter is required' }, { status: 400 });

	log.info(`Unfavoriting recipeId=${recipeId}`);
	await db.delete(recipeFavorites).where(eq(recipeFavorites.recipeId, recipeId));
	return json({ ok: true });
};
