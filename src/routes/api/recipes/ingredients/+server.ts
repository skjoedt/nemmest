import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NEMLIG_BASE_URL, NEMLIG_STATIC_HEADERS } from '$lib/nemlig';
import { checkBurstLimit } from '$lib/rate-limit';
import { VALID_SORT_ORDERS, type RecipeIngredient, type RecipeSortOrder } from '$lib/types';
import { logger } from '$lib/logger';

const log = logger.withTag('recipes/ingredients');

// Raw shape from GetProductSelections
interface RawProductSelection {
	ProductSelectionId: string;
	ProductGroupId: string;
	Title: string;
	IsSupplementProduct: boolean;
	IsNecessary: boolean;
	Product: {
		Id: string;
		Name: string;
		PrimaryImage?: string;
		Url?: string;
		Price: number;
		PriceForCurrentRecipe: number;
		AmountForCurrentRecipe: number;
		UnitPrice?: string;
	};
}

interface RawGetProductSelectionsResponse {
	Products?: RawProductSelection[];
}

function normalizeIngredient(sel: RawProductSelection): RecipeIngredient {
	return {
		productSelectionId: sel.ProductSelectionId,
		productGroupId: sel.ProductGroupId,
		title: sel.Title.trim(),
		productId: sel.Product.Id,
		productName: sel.Product.Name,
		productImageUrl: sel.Product.PrimaryImage ?? null,
		productUrl: sel.Product.Url ? `https://www.nemlig.com/${sel.Product.Url}` : null,
		price: sel.Product.PriceForCurrentRecipe,
		unitPrice: sel.Product.UnitPrice ?? '',
		amount: sel.Product.AmountForCurrentRecipe,
		isSupplementProduct: sel.IsSupplementProduct,
		isNecessary: sel.IsNecessary,
	};
}

// GET /api/recipes/ingredients?recipeId=<uuid>&sortorder=<default|priceasc|recommended|organic>&persons=<1-10>
//
// This endpoint calls the Nemlig webapi directly rather than routing through the
// /api/nemlig/[...path] proxy for two reasons:
//   1. The proxy requires a valid session cookie — GetProductSelections is a public
//      endpoint that works without authentication.
//   2. We normalise the raw Nemlig shape here (RawProductSelection → RecipeIngredient)
//      which isn't something the generic proxy can do.
export const GET: RequestHandler = async ({ url }) => {
	const recipeId = url.searchParams.get('recipeId');
	if (!recipeId) {
		return json({ error: 'recipeId is required' }, { status: 400 });
	}

	// Basic UUID format check — recipeId is forwarded as a query param (not a path
	// segment), so injection risk is low, but we validate it defensively.
	if (!/^[0-9a-f-]{36}$/i.test(recipeId)) {
		return json({ error: 'recipeId must be a valid UUID' }, { status: 400 });
	}

	const rawSortorder = url.searchParams.get('sortorder') ?? 'default';
	const sortorder: RecipeSortOrder = VALID_SORT_ORDERS.has(rawSortorder as RecipeSortOrder)
		? (rawSortorder as RecipeSortOrder)
		: 'default';

	const parsedPersons = parseInt(url.searchParams.get('persons') ?? '4', 10);
	const persons = Math.min(10, Math.max(1, isNaN(parsedPersons) ? 4 : parsedPersons));

	log.debug(`recipeId=${recipeId} sortorder=${sortorder} persons=${persons}`);

	const limit = checkBurstLimit();
	if (!limit.ok) {
		return json(
			{ error: 'Too many requests', reason: 'rate_limited' },
			{ status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
		);
	}

	// The four path slots are URL routing artifacts — the Nemlig server ignores their
	// values entirely and only reads the query params (recipeId, sortorder, personsAmount).
	// Using placeholder values avoids having to replicate a valid session path here.
	// TODO: if Nemlig ever adds path-based validation this will need real values from
	// a session context (similar to how products/search uses getSearchContext).
	const ingredientsUrl = new URL(
		`${NEMLIG_BASE_URL}/x/x/1/1/Recipe/GetProductSelections`
	);
	ingredientsUrl.searchParams.set('recipeId', recipeId);
	ingredientsUrl.searchParams.set('sortorder', sortorder);
	ingredientsUrl.searchParams.set('personsAmount', String(persons));

	log.info(`GET ${ingredientsUrl}`);

	let res: Response;
	try {
		res = await fetch(ingredientsUrl.toString(), {
			headers: { ...NEMLIG_STATIC_HEADERS, 'x-correlation-id': crypto.randomUUID() },
		});
	} catch (e) {
		log.error('Network error reaching nemlig.com:', e);
		return json({ error: 'Could not reach nemlig.com' }, { status: 502 });
	}

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		log.error(`Upstream error ${res.status}:`, text.slice(0, 200));
		return json({ error: `nemlig.com error ${res.status}` }, { status: res.status });
	}

	let data: RawGetProductSelectionsResponse | null = null;
	try {
		data = await res.json() as RawGetProductSelectionsResponse;
	} catch (e) {
		log.error('JSON parse error:', e);
		return json({ error: 'Invalid response from nemlig.com' }, { status: 502 });
	}

	const rawProducts = data?.Products ?? [];
	const nullProducts = rawProducts.filter((sel) => sel.Product == null);
	if (nullProducts.length > 0) {
		const names = nullProducts.map((sel) => sel.Title.trim()).join(', ');
		log.warn(`recipeId=${recipeId} → skipping ${nullProducts.length} ingredient(s) with null Product: ${names}`);
	}
	const ingredients = rawProducts.filter((sel) => sel.Product != null).map(normalizeIngredient);
	// Exclude optional (supplement) products from the price total — they are
	// shown in the UI for reference but should not affect cost or the basket.
	const total = ingredients
		.filter((i) => !i.isSupplementProduct)
		.reduce((sum, i) => sum + i.price, 0);

	log.info(`recipeId=${recipeId} → ${ingredients.length} ingredients, total=${total}`);

	return json({ ingredients, total });
};
