import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { recipeIngredients, recipePriceHistory, toFavoriteIngredient } from '$lib/schema';
import { eq, max } from 'drizzle-orm';
import { fetchProductSelections, type RawProductSelection } from '$lib/nemlig';
import { parseSortOrder, type RecipeIngredient } from '$lib/types';
import { enforceBurstLimit } from '$lib/rate-limit';
import { logger } from '$lib/logger';

const log = logger.withTag('recipes/ingredients');

function normalizeIngredient(sel: RawProductSelection): RecipeIngredient {
	const p = sel.Product!;
	return {
		productSelectionId: sel.ProductSelectionId,
		productGroupId: sel.ProductGroupId,
		title: sel.Title.trim(),
		productId: p.Id,
		productName: p.Name,
		productImageUrl: p.PrimaryImage ?? null,
		productUrl: p.Url ? `https://www.nemlig.com/${p.Url}` : null,
		price: p.PriceForCurrentRecipe,
		unitPrice: p.UnitPrice ?? '',
		amount: p.AmountForCurrentRecipe,
		isSupplementProduct: sel.IsSupplementProduct,
		isNecessary: sel.IsNecessary,
	};
}

// GET /api/recipes/ingredients?recipeId=<uuid>&sortorder=<x>&persons=<n>
// Proxies GetProductSelections for search result price display.
export const GET: RequestHandler = async ({ url }) => {
	const recipeId = url.searchParams.get('recipeId');
	if (!recipeId) return json({ error: 'recipeId is required' }, { status: 400 });
	if (!/^[0-9a-f-]{36}$/i.test(recipeId)) return json({ error: 'recipeId must be a valid UUID' }, { status: 400 });

	const limited = enforceBurstLimit();
	if (limited) return limited;

	const sortorder = parseSortOrder(url.searchParams.get('sortorder'));
	const parsedPersons = parseInt(url.searchParams.get('persons') ?? '4', 10);
	const persons = Math.min(10, Math.max(1, isNaN(parsedPersons) ? 4 : parsedPersons));

	let selections: RawProductSelection[];
	try {
		selections = await fetchProductSelections(recipeId, sortorder, persons);
	} catch (e) {
		log.error(`Failed to fetch product selections for recipeId=${recipeId}:`, e);
		return json({ error: 'Could not fetch recipe ingredients from nemlig.com' }, { status: 502 });
	}

	const ingredients = selections.map(normalizeIngredient);
	const total = ingredients
		.filter((i) => !i.isSupplementProduct)
		.reduce((sum, i) => sum + i.price, 0);

	log.info(`recipeId=${recipeId} → ${ingredients.length} ingredients, total=${total}`);

	return json({ ingredients, total });
};

// PUT /api/recipes/ingredients — update a single stored ingredient
// Body: { id, quantity?, isDeselected? }
export const PUT: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null) as {
		id?: unknown;
		quantity?: unknown;
		isDeselected?: unknown;
	} | null;

	if (typeof body?.id !== 'number') {
		return json({ error: 'id (number) is required' }, { status: 400 });
	}

	const updates: Partial<{ quantity: number; isDeselected: boolean }> = {};

	if (typeof body.quantity === 'number' && Number.isInteger(body.quantity) && body.quantity >= 1) {
		updates.quantity = body.quantity;
	}
	if (typeof body.isDeselected === 'boolean') {
		updates.isDeselected = body.isDeselected;
	}

	if (Object.keys(updates).length === 0) {
		return json({ error: 'No valid fields to update' }, { status: 400 });
	}

	log.info(`PUT ingredient id=${body.id}`, updates);

	const rows = await db
		.update(recipeIngredients)
		.set(updates)
		.where(eq(recipeIngredients.id, body.id))
		.returning();

	if (rows.length === 0) {
		return json({ error: 'Ingredient not found' }, { status: 404 });
	}

	const i = rows[0];
	return json(toFavoriteIngredient(i));
};

// POST /api/recipes/ingredients — add a custom product to a favorite recipe
// Body: { recipeId, productId, productName, productDescription?, productImageUrl?, productUrl?, price }
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null) as {
		recipeId?: unknown;
		productId?: unknown;
		productName?: unknown;
		productDescription?: unknown;
		productImageUrl?: unknown;
		productUrl?: unknown;
		price?: unknown;
	} | null;

	if (typeof body?.recipeId !== 'string' || !body.recipeId.trim()) {
		return json({ error: 'recipeId (string) is required' }, { status: 400 });
	}
	if (typeof body?.productId !== 'string' || !body.productId.trim()) {
		return json({ error: 'productId (string) is required' }, { status: 400 });
	}
	if (typeof body?.productName !== 'string' || !body.productName.trim()) {
		return json({ error: 'productName (string) is required' }, { status: 400 });
	}
	if (typeof body?.price !== 'number' || !isFinite(body.price) || body.price < 0) {
		return json({ error: 'price (non-negative number) is required' }, { status: 400 });
	}

	const recipeId = body.recipeId.trim();

	const [{ maxSort }] = await db
		.select({ maxSort: max(recipeIngredients.sortOrder) })
		.from(recipeIngredients)
		.where(eq(recipeIngredients.recipeId, recipeId));

	const sortOrder = (maxSort ?? -1) + 1;

	log.info(`Adding custom ingredient to recipeId=${recipeId}: ${body.productName} price=${body.price}`);

	const [row] = await db
		.insert(recipeIngredients)
		.values({
			recipeId,
			productId: body.productId.trim(),
			productName: body.productName.trim(),
			productDescription: typeof body.productDescription === 'string' ? body.productDescription : null,
			productImageUrl: typeof body.productImageUrl === 'string' ? body.productImageUrl : null,
			productUrl: typeof body.productUrl === 'string' ? body.productUrl : null,
			quantity: 1,
			price: body.price.toFixed(2),
			isDeselected: false,
			isCustom: true,
			sortOrder,
		})
		.returning();

	// Reset price history since the ingredient set changed
	await db.delete(recipePriceHistory).where(eq(recipePriceHistory.recipeId, recipeId));
	log.info(`Custom ingredient added id=${row.id}, price history reset for recipeId=${recipeId}`);

	return json(toFavoriteIngredient(row), { status: 201 });
};

// DELETE /api/recipes/ingredients?id=<ingredientId> — remove a single ingredient
export const DELETE: RequestHandler = async ({ url }) => {
	const idParam = url.searchParams.get('id');
	if (!idParam) {
		return json({ error: 'id query parameter is required' }, { status: 400 });
	}
	const id = parseInt(idParam, 10);
	if (isNaN(id)) {
		return json({ error: 'id must be a number' }, { status: 400 });
	}

	const deleted = await db
		.delete(recipeIngredients)
		.where(eq(recipeIngredients.id, id))
		.returning({ recipeId: recipeIngredients.recipeId });

	if (deleted.length === 0) {
		return json({ error: 'Ingredient not found' }, { status: 404 });
	}

	// Reset price history since ingredients changed
	const recipeId = deleted[0].recipeId;
	await db.delete(recipePriceHistory).where(eq(recipePriceHistory.recipeId, recipeId));

	log.info(`Deleted ingredient id=${id} from recipeId=${recipeId}, price history reset`);

	return json({ ok: true });
};
