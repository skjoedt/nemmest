import { NEMLIG_STATIC_HEADERS } from '$lib/nemlig';
import { getSearchContext } from '$lib/nemlig-context';
import type { IngredientAvailability, NemligProduct } from '$lib/types';

interface StoredIngredient {
	id: number;
	productId: string;
	productUrl: string | null;
}

function productIdFromUrl(url: URL): string | null {
	return url.pathname.match(/-(\d+)\/?$/)?.[1] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

async function fetchReplacementProduct(productUrl: URL): Promise<NemligProduct | null> {
	const context = await getSearchContext().catch(() => null);
	if (!context) return null;

	const requestUrl = new URL(productUrl);
	requestUrl.searchParams.set('GetAsJson', '1');
	requestUrl.searchParams.set('t', context.timestamp);
	requestUrl.searchParams.set('d', String(context.deliveryZoneId));

	const response = await fetch(requestUrl, {
		headers: { ...NEMLIG_STATIC_HEADERS, 'x-correlation-id': crypto.randomUUID() },
		signal: AbortSignal.timeout(10_000),
	}).catch(() => null);
	if (!response?.ok) return null;

	const data = asRecord(await response.json().catch(() => null));
	const product = asRecord(data?.Product) ?? data;
	if (!product || typeof product.Id !== 'string' || typeof product.Name !== 'string') return null;

	const price = typeof product.Price === 'number' ? product.Price : 0;
	const campaign = asRecord(product.Campaign);
	const campaignPrice = typeof campaign?.CampaignPrice === 'number' ? campaign.CampaignPrice : null;

	return {
		id: product.Id,
		name: product.Name,
		description: typeof product.Description === 'string' ? product.Description : null,
		imageUrl: typeof product.PrimaryImage === 'string' ? product.PrimaryImage : null,
		brand: typeof product.Brand === 'string' ? product.Brand : null,
		price,
		campaignPrice,
		discountSavings: typeof campaign?.DiscountSavings === 'number' ? campaign.DiscountSavings : null,
		unitPrice: typeof product.UnitPrice === 'string' ? product.UnitPrice : null,
		unitPriceLabel: typeof product.UnitPriceLabel === 'string' ? product.UnitPriceLabel : null,
		isOnSale: campaignPrice !== null && campaignPrice < price,
		url: productUrl.toString(),
	};
}

export async function checkIngredientAvailability(
	ingredient: StoredIngredient,
): Promise<IngredientAvailability> {
	if (!ingredient.productUrl) {
		return {
			ingredientId: ingredient.id,
			status: 'unknown',
			replacement: null,
			replacementUrl: null,
			checkedAt: null,
			retryAfter: null,
			fromCache: false,
		};
	}

	let productUrl: URL;
	try {
		productUrl = new URL(ingredient.productUrl);
	} catch {
		return {
			ingredientId: ingredient.id,
			status: 'unknown',
			replacement: null,
			replacementUrl: null,
			checkedAt: null,
			retryAfter: null,
			fromCache: false,
		};
	}

	const response = await fetch(productUrl, {
		redirect: 'manual',
		headers: { ...NEMLIG_STATIC_HEADERS, 'x-correlation-id': crypto.randomUUID() },
		signal: AbortSignal.timeout(10_000),
	}).catch(() => null);

	if (!response) {
		return {
			ingredientId: ingredient.id,
			status: 'unknown',
			replacement: null,
			replacementUrl: null,
			checkedAt: null,
			retryAfter: null,
			fromCache: false,
		};
	}
	if (response.status === 404 || response.status === 410) {
		return {
			ingredientId: ingredient.id,
			status: 'unavailable',
			replacement: null,
			replacementUrl: null,
			checkedAt: null,
			retryAfter: null,
			fromCache: false,
		};
	}
	if (response.status < 300 || response.status >= 400) {
		return {
			ingredientId: ingredient.id,
			status: response.ok ? 'available' : 'unknown',
			replacement: null,
			replacementUrl: null,
			checkedAt: null,
			retryAfter: null,
			fromCache: false,
		};
	}

	const location = response.headers.get('location');
	if (!location) {
		return {
			ingredientId: ingredient.id,
			status: 'unknown',
			replacement: null,
			replacementUrl: null,
			checkedAt: null,
			retryAfter: null,
			fromCache: false,
		};
	}

	let replacementUrl: URL;
	try {
		replacementUrl = new URL(location, productUrl);
	} catch {
		return {
			ingredientId: ingredient.id,
			status: 'unknown',
			replacement: null,
			replacementUrl: null,
			checkedAt: null,
			retryAfter: null,
			fromCache: false,
		};
	}
	if (replacementUrl.hash === '#404') {
		return {
			ingredientId: ingredient.id,
			status: 'unavailable',
			replacement: null,
			replacementUrl: null,
			checkedAt: null,
			retryAfter: null,
			fromCache: false,
		};
	}

	const replacementId = productIdFromUrl(replacementUrl);
	if (!replacementId || replacementId === ingredient.productId) {
		return {
			ingredientId: ingredient.id,
			status: 'unknown',
			replacement: null,
			replacementUrl: null,
			checkedAt: null,
			retryAfter: null,
			fromCache: false,
		};
	}

	return {
		ingredientId: ingredient.id,
		status: 'unavailable',
		replacement: await fetchReplacementProduct(replacementUrl),
		replacementUrl: replacementUrl.toString(),
		checkedAt: null,
		retryAfter: null,
		fromCache: false,
	};
}

export async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	mapper: (item: T) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			results[index] = await mapper(items[index]);
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}
