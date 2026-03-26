import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NEMLIG_BASE_URL, NEMLIG_STATIC_HEADERS } from '$lib/nemlig';
import { checkBurstLimit } from '$lib/rate-limit';
import type { NemligProduct } from '$lib/types';

const GATEWAY_SEARCH = 'https://webapi.prod.knl.nemlig.it/searchgateway/api/search';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NemligTokenResponse {
	access_token: string;
	expires_in: number;
}

interface NemligWebApiRoot {
	Settings?: {
		CombinedProductsAndSitecoreTimestamp?: string;
		TimeslotUtc?: string;
		DeliveryZoneId?: number;
	};
}

// Context needed to call the search gateway
interface SearchContext {
	jwt: string;
	jwtExpiresAt: number; // ms epoch
	timestamp: string; // CombinedProductsAndSitecoreTimestamp
	timeslotUtc: string;
	deliveryZoneId: number;
}

// ── Token + context cache ─────────────────────────────────────────────────────

let contextCache: SearchContext | null = null;

async function getSearchContext(): Promise<SearchContext | null> {
	// Refresh 30s before JWT expiry
	if (contextCache && Date.now() < contextCache.jwtExpiresAt - 30_000) {
		return contextCache;
	}

	// Search is public — no session cookies needed. The JWT from /Token is anonymous
	// and returns the same results for all users.
	const headers = { ...NEMLIG_STATIC_HEADERS, accept: 'application/json', 'x-correlation-id': crypto.randomUUID() };

	const [tokenRes, rootRes] = await Promise.all([
		fetch(`${NEMLIG_BASE_URL}/Token`, { headers }).catch(() => null),
		fetch(NEMLIG_BASE_URL, { headers }).catch(() => null),
	]);

	if (!tokenRes?.ok) return null;

	const tokenBody = await tokenRes.json().catch(() => null) as NemligTokenResponse | null;
	if (!tokenBody?.access_token) return null;

	const rootBody = await rootRes?.json().catch(() => null) as NemligWebApiRoot | null;
	const settings = rootBody?.Settings;

	const timestamp = settings?.CombinedProductsAndSitecoreTimestamp ?? '';
	if (!timestamp) return null;

	contextCache = {
		jwt: tokenBody.access_token,
		jwtExpiresAt: Date.now() + tokenBody.expires_in * 1000,
		timestamp,
		timeslotUtc: settings?.TimeslotUtc ?? '',
		deliveryZoneId: settings?.DeliveryZoneId ?? 1,
	};

	return contextCache;
}

// ── Gateway product shape ─────────────────────────────────────────────────────

interface GatewayProduct {
	Id: string;
	Name: string;
	Description?: string;
	PrimaryImage?: string;
	Brand?: string;
	Price?: number;
	UnitPriceCalc?: number;
	UnitPriceLabel?: string;
	DiscountItem?: boolean;
	Url?: string;
	Campaign?: {
		CampaignPrice?: number;
		DiscountSavings?: number;
		Type?: string;
		MinQuantity?: number;
	};
}

interface GatewaySearchResponse {
	Products?: {
		Products?: GatewayProduct[];
		NumFound?: number;
	};
}

function normalizeProduct(p: GatewayProduct): NemligProduct {
	const price = p.Price ?? 0;
	const campaignPrice = p.Campaign?.CampaignPrice ?? null;
	const isOnSale = campaignPrice !== null && campaignPrice < price;
	const discountSavings = isOnSale
		? (p.Campaign?.DiscountSavings && p.Campaign.DiscountSavings > 0
			? p.Campaign.DiscountSavings
			: price - campaignPrice)
		: null;

	// UnitPriceLabel from gateway is just "kr/kg", format with UnitPriceCalc
	const unitPrice = p.UnitPriceCalc != null && p.UnitPriceLabel
		? `${p.UnitPriceCalc.toFixed(2).replace('.', ',')} ${p.UnitPriceLabel}`
		: null;

	return {
		id: p.Id,
		name: p.Name,
		description: p.Description ?? null,
		imageUrl: p.PrimaryImage ?? null,
		brand: p.Brand ?? null,
		price,
		campaignPrice,
		discountSavings,
		unitPrice,
		unitPriceLabel: p.UnitPriceLabel ?? null,
		isOnSale,
		url: p.Url ? `https://www.nemlig.com/${p.Url}` : null,
	};
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 2) {
		return json({ products: [], numFound: 0 });
	}

	const limit = checkBurstLimit();
	if (!limit.ok) {
		return json(
			{ error: 'Too many requests', reason: 'rate_limited' },
			{ status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
		);
	}

	let ctx: SearchContext | null;
	try {
		ctx = await getSearchContext();
	} catch (e) {
		console.error('[products/search] Failed to build search context:', e);
		return json({ error: 'Could not reach nemlig.com' }, { status: 502 });
	}

	if (!ctx) {
		return json({ error: 'Could not retrieve nemlig.com search token' }, { status: 502 });
	}

	const searchUrl = new URL(GATEWAY_SEARCH);
	searchUrl.searchParams.set('query', q);
	searchUrl.searchParams.set('take', '24');
	searchUrl.searchParams.set('skip', String((parseInt(url.searchParams.get('page') ?? '0', 10)) * 24));
	searchUrl.searchParams.set('timestamp', ctx.timestamp);
	if (ctx.timeslotUtc) searchUrl.searchParams.set('timeslotUtc', ctx.timeslotUtc);
	searchUrl.searchParams.set('deliveryZoneId', String(ctx.deliveryZoneId));

	let gatewayRes: Response;
	try {
		// Omit content-type on this GET — the gateway interprets it as expecting
		// a JSON body and returns 400 "does not contain JSON tokens" if present.
		const { 'content-type': _ct, ...gatewayHeaders } = NEMLIG_STATIC_HEADERS;
		gatewayRes = await fetch(searchUrl.toString(), {
			headers: {
				...gatewayHeaders,
				'Authorization': `Bearer ${ctx.jwt}`,
				'x-correlation-id': crypto.randomUUID(),
			},
		});
	} catch (e) {
		console.error('[products/search] Gateway fetch error:', e);
		error(502, 'Could not reach nemlig.com search');
	}

	if (!gatewayRes.ok) {
		if (gatewayRes.status === 401) {
			// JWT expired — invalidate cache and retry on next request
			contextCache = null;
			return json({ error: 'Search token expired. Please try again.', reason: 'token_expired' }, { status: 401 });
		}
		const text = await gatewayRes.text().catch(() => '');
		console.error(`[products/search] Gateway error ${gatewayRes.status}:`, text.slice(0, 200));
		return json({ error: `Search error ${gatewayRes.status}` }, { status: gatewayRes.status });
	}

	let data: GatewaySearchResponse | null = null;
	try {
		data = await gatewayRes.json() as GatewaySearchResponse;
	} catch (e) {
		console.error('[products/search] JSON parse error:', e);
		return json({ error: 'Invalid search response from nemlig.com' }, { status: 502 });
	}

	const products = data?.Products?.Products ?? [];
	const numFound = data?.Products?.NumFound ?? products.length;

	return json({
		products: products.map(normalizeProduct),
		numFound,
	});
};
