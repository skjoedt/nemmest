import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { productFavorites } from '$lib/schema';
import { eq } from 'drizzle-orm';

// GET /api/favorites — list all saved favorites
export const GET: RequestHandler = async () => {
	const rows = await db
		.select()
		.from(productFavorites)
		.orderBy(productFavorites.addedAt);
	return json(rows);
};

// POST /api/favorites — add or update a favorite
// Body: { productId, name, description?, imageUrl?, brand?, url? }
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null) as {
		productId?: unknown;
		name?: unknown;
		description?: unknown;
		imageUrl?: unknown;
		brand?: unknown;
		url?: unknown;
	} | null;

	if (typeof body?.productId !== 'number') {
		return json({ error: 'productId (number) is required' }, { status: 400 });
	}
	if (typeof body?.name !== 'string' || !body.name.trim()) {
		return json({ error: 'name (string) is required' }, { status: 400 });
	}

	const url = typeof body.url === 'string' ? body.url : null;

	const row = await db
		.insert(productFavorites)
		.values({
			productId: body.productId,
			name: body.name.trim(),
			description: typeof body.description === 'string' ? body.description : null,
			imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
			brand: typeof body.brand === 'string' ? body.brand : null,
			url,
		})
		.onConflictDoUpdate({
			target: productFavorites.productId,
			set: {
				name: body.name.trim(),
				description: typeof body.description === 'string' ? body.description : null,
				imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
				brand: typeof body.brand === 'string' ? body.brand : null,
				url,
			},
		})
		.returning();

	return json(row[0], { status: 201 });
};

// DELETE /api/favorites?id=<productId> — remove a favorite
export const DELETE: RequestHandler = async ({ url }) => {
	const idParam = url.searchParams.get('id');
	const productId = idParam ? parseInt(idParam, 10) : NaN;

	if (isNaN(productId)) {
		return json({ error: 'id (productId) query parameter is required' }, { status: 400 });
	}

	await db.delete(productFavorites).where(eq(productFavorites.productId, productId));
	return json({ ok: true });
};
