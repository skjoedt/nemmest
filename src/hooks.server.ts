import type { Handle } from '@sveltejs/kit';
import { logger } from '$lib/logger';
import cron from 'node-cron';
import { fetchRecipePrices } from '$lib/workers/fetch-recipe-prices';

const log = logger.withTag('request');
const cronLog = logger.withTag('cron');

// Extensions that are never interesting to log
const STATIC_EXT = /\.(js|css|ico|png|jpg|jpeg|svg|woff2?|ttf|map)$/i;

// Schedule daily recipe price fetch at 06:00
cron.schedule('0 6 * * *', () => {
	cronLog.info('Triggering daily recipe price fetch');
	fetchRecipePrices().catch((e) => cronLog.error('fetchRecipePrices failed:', e));
});

export const handle: Handle = async ({ event, resolve }) => {
	const { method } = event.request;
	const { pathname } = new URL(event.request.url);
	const start = Date.now();

	const response = await resolve(event);

	if (!STATIC_EXT.test(pathname)) {
		log.info(`${method} ${pathname} ${response.status} ${Date.now() - start}ms`);
	}

	return response;
};
