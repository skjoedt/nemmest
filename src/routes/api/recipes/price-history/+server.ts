import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { recipePriceHistory } from '$lib/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { parseSortOrder } from '$lib/types';
import { parsePersonsSetting } from '$lib/settings';
import { logger } from '$lib/logger';

const log = logger.withTag('recipes/price-history');

// GET /api/recipes/price-history?recipeId=<uuid>&persons=<n>&sortOrder=<x>
//
// Returns the last 90 days of price snapshots for the given recipe+config,
// plus the 30-day low. Only rows matching the exact persons + sortOrder are
// returned so the graph always reflects the current card configuration.
export const GET: RequestHandler = async ({ url }) => {
	const recipeId = url.searchParams.get('recipeId');
	if (!recipeId) {
		return json({ error: 'recipeId is required' }, { status: 400 });
	}
	if (!/^[0-9a-f-]{36}$/i.test(recipeId)) {
		return json({ error: 'recipeId must be a valid UUID' }, { status: 400 });
	}

	const persons = parsePersonsSetting({ persons: url.searchParams.get('persons') ?? '' });
	const sortOrder = parseSortOrder(url.searchParams.get('sortOrder'));

	const since = new Date();
	since.setDate(since.getDate() - 90);

	log.debug(`recipeId=${recipeId} persons=${persons} sortOrder=${sortOrder}`);

	const rows = await db
		.select({
			date: sql<string>`(${recipePriceHistory.fetchedAt}::date)::text`,
			price: recipePriceHistory.price,
		})
		.from(recipePriceHistory)
		.where(
			and(
				eq(recipePriceHistory.recipeId, recipeId),
				eq(recipePriceHistory.persons, persons),
				eq(recipePriceHistory.sortOrder, sortOrder),
				gte(recipePriceHistory.fetchedAt, since),
			),
		)
		.orderBy(recipePriceHistory.fetchedAt);

	const history = rows.map((r) => ({ date: r.date, price: parseFloat(r.price) }));

	const cutoff30 = new Date();
	cutoff30.setDate(cutoff30.getDate() - 30);
	const cutoff30Str = cutoff30.toISOString().slice(0, 10);

	const prices30 = history.filter((r) => r.date >= cutoff30Str).map((r) => r.price);
	const low30 = prices30.length > 0 ? Math.min(...prices30) : null;

	log.info(`recipeId=${recipeId} → ${history.length} snapshots, low30=${low30}`);

	return json({ history, low30 });
};
