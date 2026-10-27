import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { recipeIngredients } from '$lib/schema';
import { checkIngredientAvailability, mapWithConcurrency } from '$lib/server/recipe-availability';
import type { IngredientAvailability, IngredientAvailabilityStatus } from '$lib/types';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { enforceBurstLimit } from '$lib/rate-limit';
import { logger } from '$lib/logger';

const log = logger.withTag('recipes/availability');
const CONCURRENCY = 2;
const CACHE_TTL_MS = 6 * 60 * 60_000;
const RETRY_DELAY_MS = 10 * 60_000;
const LEASE_MS = 5 * 60_000;

function statusOf(value: string): IngredientAvailabilityStatus {
	return value === 'available' || value === 'unavailable' ? value : 'unknown';
}

function asResult(
	ingredientId: number,
	status: IngredientAvailabilityStatus,
	checkedAt: Date | null,
	retryAfter: Date | null,
	fromCache: boolean,
): IngredientAvailability {
	return {
		ingredientId,
		status,
		replacement: null,
		replacementUrl: null,
		checkedAt: checkedAt?.toISOString() ?? null,
		retryAfter: retryAfter?.toISOString() ?? null,
		fromCache,
	};
}

export const POST: RequestHandler = async ({ request }) => {
	const limited = enforceBurstLimit();
	if (limited) return limited;

	const body = await request.json().catch(() => null) as { recipeId?: unknown; force?: unknown } | null;
	if (typeof body?.recipeId !== 'string' || !body.recipeId.trim()) {
		return json({ error: 'recipeId is required' }, { status: 400 });
	}

	const recipeId = body.recipeId.trim();
	const force = body.force === true;
	const ingredients = (await db
		.select()
		.from(recipeIngredients)
		.where(eq(recipeIngredients.recipeId, recipeId)))
		.filter((ingredient) => !ingredient.isDeselected && !ingredient.isCustom);
	const now = new Date();
	const leaseUntil = new Date(now.getTime() + LEASE_MS);
	const results: IngredientAvailability[] = [];
	const claimed = [] as typeof ingredients;

	for (const ingredient of ingredients) {
		const status = statusOf(ingredient.availabilityStatus);
		const isFresh = ingredient.availabilityCheckedAt
			&& now.getTime() - ingredient.availabilityCheckedAt.getTime() < CACHE_TTL_MS;
		if (!force && isFresh && status !== 'unknown') {
			results.push(asResult(ingredient.id, status, ingredient.availabilityCheckedAt, null, true));
			continue;
		}
		if (!force && ingredient.availabilityRetryAfter && ingredient.availabilityRetryAfter > now) {
			results.push(asResult(ingredient.id, 'unknown', ingredient.availabilityCheckedAt, ingredient.availabilityRetryAfter, true));
			continue;
		}

		const rows = await db
			.update(recipeIngredients)
			.set({ availabilityLeaseUntil: leaseUntil })
			.where(and(
				eq(recipeIngredients.id, ingredient.id),
				or(isNull(recipeIngredients.availabilityLeaseUntil), lt(recipeIngredients.availabilityLeaseUntil, now)),
			))
			.returning();
		if (rows.length === 1) claimed.push(ingredient);
		else results.push(asResult(ingredient.id, 'unknown', ingredient.availabilityCheckedAt, leaseUntil, true));
	}

	const checked = await mapWithConcurrency(claimed, CONCURRENCY, checkIngredientAvailability);
	await Promise.all(checked.map(async (availability) => {
		const ingredient = claimed.find((item) => item.id === availability.ingredientId)!;
		if (availability.status === 'unknown') {
			const retryAfter = new Date(Date.now() + RETRY_DELAY_MS);
			await db.update(recipeIngredients).set({
				availabilityRetryAfter: retryAfter,
				availabilityLeaseUntil: null,
			}).where(eq(recipeIngredients.id, ingredient.id));
			results.push({ ...availability, retryAfter: retryAfter.toISOString() });
			return;
		}

		const checkedAt = new Date();
		await db.update(recipeIngredients).set({
			isUnavailable: availability.status === 'unavailable',
			availabilityStatus: availability.status,
			availabilityCheckedAt: checkedAt,
			availabilityRetryAfter: null,
			availabilityLeaseUntil: null,
		}).where(eq(recipeIngredients.id, ingredient.id));
		results.push({ ...availability, checkedAt: checkedAt.toISOString() });
	}));

	log.info(`Checked ${claimed.length} stale ingredients for recipeId=${recipeId}; ${results.length - claimed.length} cached`);
	return json({ recipes: [{ recipeId, ingredients: results }] });
};
