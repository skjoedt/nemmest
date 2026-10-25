import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { recipeIngredients } from '$lib/schema';
import { checkIngredientAvailability, mapWithConcurrency } from '$lib/server/recipe-availability';
import type { RecipeAvailabilityResult } from '$lib/types';
import { eq } from 'drizzle-orm';
import { enforceBurstLimit } from '$lib/rate-limit';
import { logger } from '$lib/logger';

const log = logger.withTag('recipes/availability');
const CONCURRENCY = 6;

export const POST: RequestHandler = async ({ request }) => {
	const limited = enforceBurstLimit();
	if (limited) return limited;

	const body = await request.json().catch(() => null) as { recipeId?: unknown } | null;
	if (body?.recipeId !== undefined && typeof body.recipeId !== 'string') {
		return json({ error: 'recipeId must be a string' }, { status: 400 });
	}

	const recipeId = body?.recipeId?.trim() || null;
	const ingredients = recipeId
		? await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId))
		: await db.select().from(recipeIngredients);

	const checked = await mapWithConcurrency(ingredients, CONCURRENCY, checkIngredientAvailability);

	await Promise.all(checked.map((availability) => {
		if (availability.status === 'unknown') return Promise.resolve();
		return db
			.update(recipeIngredients)
			.set({ isUnavailable: availability.status === 'unavailable' })
			.where(eq(recipeIngredients.id, availability.ingredientId));
	}));

	const availabilityByIngredient = new Map(checked.map((item) => [item.ingredientId, item]));
	const byRecipe = new Map<string, RecipeAvailabilityResult>();
	for (const ingredient of ingredients) {
		const recipe = byRecipe.get(ingredient.recipeId) ?? {
			recipeId: ingredient.recipeId,
			ingredients: [],
		};
		recipe.ingredients.push(availabilityByIngredient.get(ingredient.id)!);
		byRecipe.set(ingredient.recipeId, recipe);
	}

	const recipes = [...byRecipe.values()];
	log.info(`Checked ${checked.length} ingredients across ${recipes.length} recipes`);
	return json({ recipes });
};
