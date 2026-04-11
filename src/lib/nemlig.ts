import type { Cookies } from '@sveltejs/kit';
import { logger } from '$lib/logger';
import { getSearchContext } from '$lib/nemlig-context';
import type { RecipeSortOrder } from '$lib/types';

export const NEMLIG_BASE_URL = 'https://www.nemlig.com/webapi';
export const NEMLIG_SEARCH_GATEWAY_URL = 'https://webapi.prod.knl.nemlig.it/searchgateway/api/search';

// All nemlig session cookies are stored together in a single app-owned cookie.
export const NEMLIG_SESSION_COOKIE = 'nemlig_session';

export const NEMLIG_STATIC_HEADERS: Record<string, string> = {
	accept: 'application/json, text/plain, */*',
	'content-type': 'application/json',
	'device-size': 'desktop',
	platform: 'web',
	version: '11.233.0',
};

export class NemligAuthError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
		this.name = 'NemligAuthError';
	}
}

const log = logger.withTag('nemlig');

// Parses all Set-Cookie headers from a nemlig response and merges the resulting
// name→value pairs into the existing session blob in an HttpOnly app-owned cookie.
export function forwardCookies(response: Response, cookies: Cookies): void {
	const h = response.headers as unknown as { getSetCookie?: () => string[] };
	const raw = typeof h.getSetCookie === 'function'
		? h.getSetCookie()
		: (response.headers.get('set-cookie') ?? '').split(/,\s*(?=[^;,]+=)/).filter(Boolean);

	const incoming: Record<string, string> = {};

	for (const entry of raw) {
		const [nameValue] = entry.split(';');
		const eq = nameValue.indexOf('=');
		if (eq === -1) continue;
		const name = nameValue.slice(0, eq).trim();
		const value = nameValue.slice(eq + 1).trim();
		incoming[name] = value;
	}

	if (Object.keys(incoming).length === 0) return;

	// Merge into existing session so previously-set cookies (e.g. .ASPXAUTH) are preserved.
	let session: Record<string, string> = {};
	const existing = cookies.get(NEMLIG_SESSION_COOKIE);
	if (existing) {
		try {
			session = JSON.parse(existing);
		} catch (e) {
			log.error('Failed to parse nemlig_session cookie, resetting:', e);
		}
	}
	Object.assign(session, incoming);

	log.debug(`Forwarding cookies: ${Object.keys(incoming).join(', ')}`);

	cookies.set(NEMLIG_SESSION_COOKIE, JSON.stringify(session), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
	});
}

// Returns the nemlig session cookies as an upstream Cookie header string,
// or null if no session exists.
export function getNemligCookieHeader(cookies: Cookies): string | null {
	const raw = cookies.get(NEMLIG_SESSION_COOKIE);
	if (!raw) return null;
	let session: Record<string, string>;
	try {
		session = JSON.parse(raw) as Record<string, string>;
	} catch (e) {
		log.error('Failed to parse nemlig_session cookie:', e);
		return null;
	}
	const header = Object.entries(session).map(([k, v]) => `${k}=${v}`).join('; ');
	return header || null;
}

export function buildUpstreamHeaders(
	cookieHeader: string | null,
	extra?: Record<string, string>,
): Record<string, string> {
	const headers: Record<string, string> = {
		...NEMLIG_STATIC_HEADERS,
		'x-correlation-id': crypto.randomUUID(),
		...extra,
	};
	if (cookieHeader) headers['cookie'] = cookieHeader;
	return headers;
}

// Fetches the current price for a product by its nemlig.com URL using GetAsJson=1.
// Returns null on any error (network, unavailable product, parse failure).
export async function fetchProductPrice(productUrl: string): Promise<number | null> {
	const ctx = await getSearchContext();
	if (!ctx) {
		log.warn(`fetchProductPrice: no search context available for ${productUrl}`);
		return null;
	}

	const url = new URL(productUrl);
	url.searchParams.set('GetAsJson', '1');
	url.searchParams.set('t', ctx.timestamp);
	url.searchParams.set('d', String(ctx.deliveryZoneId));

	log.info(`GET ${url.toString()}`);

	let res: Response;
	try {
		res = await fetch(url.toString(), {
			headers: { ...NEMLIG_STATIC_HEADERS, 'x-correlation-id': crypto.randomUUID() },
		});
	} catch (e) {
		log.error(`fetchProductPrice network error for ${productUrl}:`, e);
		return null;
	}

	if (!res.ok) {
		log.warn(`fetchProductPrice upstream ${res.status} for ${productUrl}`);
		return null;
	}

	let data: unknown;
	try {
		data = await res.json();
	} catch (e) {
		log.error(`fetchProductPrice JSON parse error for ${productUrl}:`, e);
		return null;
	}

	const price = extractPrice(data);
	if (price === null) {
		log.warn(`fetchProductPrice: could not extract price from response for ${productUrl}`);
	}
	return price;
}

function extractPrice(data: unknown): number | null {
	if (!data || typeof data !== 'object') return null;
	const d = data as Record<string, unknown>;

	// Try common response shapes
	const price =
		d['Price'] ??
		d['price'] ??
		(d['Product'] as Record<string, unknown> | undefined)?.[('Price')] ??
		null;

	if (typeof price === 'number' && isFinite(price)) return price;
	if (typeof price === 'string') {
		const parsed = parseFloat(price.replace(',', '.'));
		if (!isNaN(parsed)) return parsed;
	}
	return null;
}

// ── GetProductSelections ──────────────────────────────────────────────────────

export interface RawProductSelection {
	ProductSelectionId: string;
	ProductGroupId: string;
	Title: string;
	IsSupplementProduct: boolean;
	IsNecessary: boolean;
	Product: {
		Id: string;
		Name: string;
		Description?: string;
		PrimaryImage?: string;
		Url?: string;
		Price: number;
		PriceForCurrentRecipe: number;
		AmountForCurrentRecipe: number;
		UnitPrice?: string;
	} | null;
}

export interface RawGetProductSelectionsResponse {
	Products?: RawProductSelection[];
}

export async function fetchProductSelections(
	recipeId: string,
	sortOrder: RecipeSortOrder,
	persons: number,
): Promise<RawProductSelection[]> {
	const url = new URL(`${NEMLIG_BASE_URL}/x/x/1/1/Recipe/GetProductSelections`);
	url.searchParams.set('recipeId', recipeId);
	url.searchParams.set('sortorder', sortOrder);
	url.searchParams.set('personsAmount', String(persons));

	log.info(`GET ${url}`);

	const res = await fetch(url.toString(), {
		headers: { ...NEMLIG_STATIC_HEADERS, 'x-correlation-id': crypto.randomUUID() },
	});

	if (!res.ok) {
		throw new Error(`Upstream error ${res.status}`);
	}

	const data = await res.json() as RawGetProductSelectionsResponse;
	return (data.Products ?? []).filter((p) => p.Product !== null);
}
