import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchRecipePrices } from '$lib/workers/fetch-recipe-prices';
import { logger } from '$lib/logger';

const log = logger.withTag('api/workers');

// Triggers the daily price fetch job immediately — useful for manual runs and testing.
export const POST: RequestHandler = async () => {
	log.info('Manual trigger of fetchRecipePrices');
	try {
		await fetchRecipePrices();
		return json({ ok: true });
	} catch (e) {
		log.error('fetchRecipePrices failed:', e);
		return json({ error: 'Job failed — see server logs for details.' }, { status: 500 });
	}
};
