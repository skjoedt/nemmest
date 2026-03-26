import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NEMLIG_STATIC_HEADERS } from '$lib/nemlig';
import { getSearchContext, invalidateSearchContext } from '$lib/nemlig-context';
import { checkBurstLimit } from '$lib/rate-limit';
import type { NemligRecipe } from '$lib/types';
import { logger } from '$lib/logger';

const log = logger.withTag('recipes/search');

const GATEWAY_SEARCH = 'https://webapi.prod.knl.nemlig.it/searchgateway/api/search';

// ── Gateway recipe shape ──────────────────────────────────────────────────────

interface GatewayRecipe {
	Id: string;
	Name: string;
	PrimaryImage?: string;
	TotalTime?: string; // e.g. "30 min" or "1 t 15 min"
	Url?: string;
	Tags?: string[];
	NumberOfPersons?: number;
}

interface GatewaySearchResponse {
	// Recipes is a plain array (indexed object), not a nested { Recipes, NumFound } wrapper
	Recipes?: GatewayRecipe[] | Record<string, GatewayRecipe>;
	RecipesNumFound?: number;
}

/** Parse "30 min", "1 t", "1 t 15 min" → total minutes */
function parseTotalTime(s: string | undefined): number | null {
	if (!s) return null;
	const hoursMatch = s.match(/(\d+)\s*t/);
	const minsMatch = s.match(/(\d+)\s*min/);
	const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
	const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;
	const total = hours * 60 + mins;
	return total > 0 ? total : null;
}

function normalizeRecipe(r: GatewayRecipe): NemligRecipe {
	return {
		id: r.Id,
		name: r.Name,
		description: null,
		imageUrl: r.PrimaryImage ?? null,
		preparationTime: parseTotalTime(r.TotalTime),
		// Url from gateway already includes leading slash e.g. "/opskrifter/..."
		url: r.Url ? `https://www.nemlig.com${r.Url.startsWith('/') ? '' : '/'}${r.Url}` : null,
	};
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 2) {
		return json({ recipes: [], numFound: 0 });
	}

	const limit = checkBurstLimit();
	if (!limit.ok) {
		return json(
			{ error: 'Too many requests', reason: 'rate_limited' },
			{ status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
		);
	}

	let ctx: Awaited<ReturnType<typeof getSearchContext>>;
	try {
		ctx = await getSearchContext();
	} catch (e) {
		log.error('Failed to build search context:', e);
		return json({ error: 'Could not reach nemlig.com' }, { status: 502 });
	}

	if (!ctx) {
		return json({ error: 'Could not retrieve nemlig.com search token' }, { status: 502 });
	}

	const searchUrl = new URL(GATEWAY_SEARCH);
	searchUrl.searchParams.set('query', q);
	// 'take' controls products; must be >= 1 or the gateway returns 500.
	// We set it to 1 to minimise product data transfer — we only want recipes.
	searchUrl.searchParams.set('take', '1');
	searchUrl.searchParams.set('timestamp', ctx.timestamp);
	if (ctx.timeslotUtc) searchUrl.searchParams.set('timeslotUtc', ctx.timeslotUtc);
	searchUrl.searchParams.set('deliveryZoneId', String(ctx.deliveryZoneId));

	let gatewayRes: Response;
	try {
		const { 'content-type': _ct, ...gatewayHeaders } = NEMLIG_STATIC_HEADERS;
		gatewayRes = await fetch(searchUrl.toString(), {
			headers: {
				...gatewayHeaders,
				'Authorization': `Bearer ${ctx.jwt}`,
				'x-correlation-id': crypto.randomUUID(),
			},
		});
	} catch (e) {
		log.error('Gateway fetch error:', e);
		error(502, 'Could not reach nemlig.com search');
	}

	if (!gatewayRes.ok) {
		if (gatewayRes.status === 401) {
			log.warn('JWT expired, invalidating context cache');
			invalidateSearchContext();
			return json({ error: 'Search token expired. Please try again.', reason: 'token_expired' }, { status: 401 });
		}
		const text = await gatewayRes.text().catch(() => '');
		log.error(`Gateway error ${gatewayRes.status}:`, text.slice(0, 200));
		return json({ error: `Search error ${gatewayRes.status}` }, { status: gatewayRes.status });
	}

	let data: GatewaySearchResponse | null = null;
	try {
		data = await gatewayRes.json() as GatewaySearchResponse;
	} catch (e) {
		log.error('JSON parse error:', e);
		return json({ error: 'Invalid search response from nemlig.com' }, { status: 502 });
	}

	// Recipes arrives as a plain array (or an indexed object when count > 0)
	const rawRecipes = data?.Recipes;
	const recipes: GatewayRecipe[] = rawRecipes
		? (Array.isArray(rawRecipes) ? rawRecipes : Object.values(rawRecipes))
		: [];
	const numFound = data?.RecipesNumFound ?? recipes.length;

	return json({
		recipes: recipes.map(normalizeRecipe),
		numFound,
	});
};
