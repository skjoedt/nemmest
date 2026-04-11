import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchSearchGateway } from '$lib/nemlig-context';
import { enforceBurstLimit } from '$lib/rate-limit';
import type { NemligRecipe } from '$lib/types';

// ── Gateway recipe shape ──────────────────────────────────────────────────────

interface GatewayRecipe {
	Id: string;
	Name: string;
	PrimaryImage?: string;
	TotalTime?: string; // e.g. "30 min" or "1 t 15 min"
	Url?: string;
}

interface GatewaySearchResponse {
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
		url: r.Url ? `https://www.nemlig.com${r.Url.startsWith('/') ? '' : '/'}${r.Url}` : null,
	};
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 2) return json({ recipes: [], numFound: 0 });

	const limited = enforceBurstLimit();
	if (limited) return limited;

	// 'take' controls products; must be >= 1 or the gateway returns 500.
	// We set it to 1 to minimise product data transfer — we only want recipes.
	const result = await fetchSearchGateway({ query: q, take: '1' });

	if ('response' in result) return result.response;

	const data = result.data as GatewaySearchResponse;
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
