// Shared search context (JWT + timestamp) for the Nemlig search gateway.
// Both products/search and recipes/search need the same anonymous JWT and
// CombinedProductsAndSitecoreTimestamp, so we cache them here to avoid
// issuing duplicate /Token requests from two separate module-level caches.

import { json } from '@sveltejs/kit';
import { NEMLIG_BASE_URL, NEMLIG_SEARCH_GATEWAY_URL, NEMLIG_STATIC_HEADERS } from '$lib/nemlig';
import { logger } from '$lib/logger';

const log = logger.withTag('nemlig-context');

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

export interface SearchContext {
	jwt: string;
	jwtExpiresAt: number; // ms epoch
	timestamp: string;    // CombinedProductsAndSitecoreTimestamp
	timeslotUtc: string;
	deliveryZoneId: number;
}

let contextCache: SearchContext | null = null;

/**
 * Returns the current search context (JWT + API timestamp), refreshing if
 * the JWT is within 30s of expiry. Returns null if nemlig.com is unreachable.
 *
 * The JWT is anonymous — no session cookies are needed for search.
 */
export async function getSearchContext(): Promise<SearchContext | null> {
	// Refresh 30s before JWT expiry
	if (contextCache && Date.now() < contextCache.jwtExpiresAt - 30_000) {
		return contextCache;
	}

	const headers = {
		...NEMLIG_STATIC_HEADERS,
		accept: 'application/json',
		'x-correlation-id': crypto.randomUUID(),
	};

	const [tokenRes, rootRes] = await Promise.all([
		fetch(`${NEMLIG_BASE_URL}/Token`, { headers }).catch(() => null),
		fetch(NEMLIG_BASE_URL, { headers }).catch(() => null),
	]);

	if (!tokenRes?.ok) {
		log.warn('Failed to fetch JWT token from nemlig.com');
		return null;
	}

	const tokenBody = await tokenRes.json().catch(() => null) as NemligTokenResponse | null;
	if (!tokenBody?.access_token) {
		log.warn('JWT token response missing access_token');
		return null;
	}

	const rootBody = await rootRes?.json().catch(() => null) as NemligWebApiRoot | null;
	const settings = rootBody?.Settings;
	const timestamp = settings?.CombinedProductsAndSitecoreTimestamp ?? '';
	if (!timestamp) {
		log.warn('Root API response missing CombinedProductsAndSitecoreTimestamp');
		return null;
	}

	contextCache = {
		jwt: tokenBody.access_token,
		jwtExpiresAt: Date.now() + tokenBody.expires_in * 1000,
		timestamp,
		timeslotUtc: settings?.TimeslotUtc ?? '',
		deliveryZoneId: settings?.DeliveryZoneId ?? 1,
	};

	log.info(`Search context refreshed (JWT expires in ${tokenBody.expires_in}s)`);

	return contextCache;
}

/** Invalidate the cached context (e.g. after a 401 from the gateway). */
export function invalidateSearchContext(): void {
	contextCache = null;
}

/**
 * Fetches the nemlig search gateway with the given params.
 * Handles context acquisition, JWT auth, 401 retry, and error responses.
 * Returns the parsed JSON body on success, or a Response to forward on failure.
 */
export async function fetchSearchGateway(
	params: Record<string, string>,
): Promise<{ data: unknown } | { response: Response }> {
	let ctx: SearchContext | null;
	try {
		ctx = await getSearchContext();
	} catch {
		return { response: json({ error: 'Could not reach nemlig.com' }, { status: 502 }) };
	}
	if (!ctx) {
		return { response: json({ error: 'Could not retrieve nemlig.com search token' }, { status: 502 }) };
	}

	const searchUrl = new URL(NEMLIG_SEARCH_GATEWAY_URL);
	for (const [k, v] of Object.entries(params)) searchUrl.searchParams.set(k, v);
	searchUrl.searchParams.set('timestamp', ctx.timestamp);
	if (ctx.timeslotUtc) searchUrl.searchParams.set('timeslotUtc', ctx.timeslotUtc);
	searchUrl.searchParams.set('deliveryZoneId', String(ctx.deliveryZoneId));

	const { 'content-type': _ct, ...gatewayHeaders } = NEMLIG_STATIC_HEADERS;

	let res: Response;
	try {
		res = await fetch(searchUrl.toString(), {
			headers: {
				...gatewayHeaders,
				Authorization: `Bearer ${ctx.jwt}`,
				'x-correlation-id': crypto.randomUUID(),
			},
		});
	} catch {
		return { response: json({ error: 'Could not reach nemlig.com search' }, { status: 502 }) };
	}

	if (!res.ok) {
		if (res.status === 401) {
			invalidateSearchContext();
			return { response: json({ error: 'Search token expired. Please try again.', reason: 'token_expired' }, { status: 401 }) };
		}
		const text = await res.text().catch(() => '');
		log.error(`Gateway error ${res.status}:`, text.slice(0, 200));
		return { response: json({ error: `Search error ${res.status}` }, { status: res.status }) };
	}

	try {
		const data = await res.json();
		return { data };
	} catch {
		return { response: json({ error: 'Invalid search response from nemlig.com' }, { status: 502 }) };
	}
}
