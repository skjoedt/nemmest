import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { recipeFavorites } from '$lib/schema';
import { eq } from 'drizzle-orm';
import { VALID_SORT_ORDERS, type RecipeSortOrder } from '$lib/types';
import { encodeIds, decodeIds } from '$lib/recipe-utils';

// GET /api/recipes/favorites — list all saved recipe favorites
export const GET: RequestHandler = async () => {
	const rows = await db
		.select()
		.from(recipeFavorites)
		.orderBy(recipeFavorites.addedAt);

	const result = rows.map((r) => ({
		...r,
		deselectedIngredientIds: decodeIds(r.deselectedIngredientIds),
	}));

	return json(result);
};

// POST /api/recipes/favorites — add or update a recipe favorite
// Body: { recipeId, name, description?, imageUrl?, preparationTime?, url?, sortOrder?, deselectedIngredientIds? }
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null) as {
		recipeId?: unknown;
		name?: unknown;
		description?: unknown;
		imageUrl?: unknown;
		preparationTime?: unknown;
		url?: unknown;
		sortOrder?: unknown;
		deselectedIngredientIds?: unknown;
	} | null;

	if (typeof body?.recipeId !== 'string' || !body.recipeId.trim()) {
		return json({ error: 'recipeId (string) is required' }, { status: 400 });
	}
	if (typeof body?.name !== 'string' || !body.name.trim()) {
		return json({ error: 'name (string) is required' }, { status: 400 });
	}

	const sortOrder: RecipeSortOrder =
		typeof body.sortOrder === 'string' && VALID_SORT_ORDERS.has(body.sortOrder as RecipeSortOrder)
			? (body.sortOrder as RecipeSortOrder)
			: 'default';
	const deselectedEncoded = encodeIds(body.deselectedIngredientIds);

	const row = await db
		.insert(recipeFavorites)
		.values({
			recipeId: body.recipeId.trim(),
			name: body.name.trim(),
			description: typeof body.description === 'string' ? body.description : null,
			imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
			preparationTime: typeof body.preparationTime === 'number' ? body.preparationTime : null,
			url: typeof body.url === 'string' ? body.url : null,
			sortOrder,
			deselectedIngredientIds: deselectedEncoded,
		})
		.onConflictDoUpdate({
			target: recipeFavorites.recipeId,
			set: {
				name: body.name.trim(),
				description: typeof body.description === 'string' ? body.description : null,
				imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
				preparationTime: typeof body.preparationTime === 'number' ? body.preparationTime : null,
				url: typeof body.url === 'string' ? body.url : null,
				sortOrder,
				deselectedIngredientIds: deselectedEncoded,
			},
		})
		.returning();

	return json({
		...row[0],
		deselectedIngredientIds: decodeIds(row[0].deselectedIngredientIds),
	}, { status: 201 });
};

// DELETE /api/recipes/favorites?id=<recipeId> — remove a recipe favorite
export const DELETE: RequestHandler = async ({ url }) => {
	const recipeId = url.searchParams.get('id');

	if (!recipeId) {
		return json({ error: 'id (recipeId) query parameter is required' }, { status: 400 });
	}

	await db.delete(recipeFavorites).where(eq(recipeFavorites.recipeId, recipeId));
	return json({ ok: true });
};
