import type { Handle } from '@sveltejs/kit';
import { logger } from '$lib/logger';
import { fetchRecipePrices } from '$lib/workers/fetch-recipe-prices';

const log = logger.withTag('request');
const cronLog = logger.withTag('cron');

// Extensions that are never interesting to log
const STATIC_EXT = /\.(js|css|ico|png|jpg|jpeg|svg|woff2?|ttf|map)$/i;

// Schedule daily recipe price fetch at 06:00 using a simple interval check.
// Runs every 15 minutes; fires once per calendar day.
let lastRunDate = '';
setInterval(() => {
	const now = new Date();
	if (now.getHours() < 6) return;
	const today = now.toISOString().slice(0, 10);
	if (today === lastRunDate) return;
	lastRunDate = today;
	cronLog.info('Triggering daily recipe price fetch');
	fetchRecipePrices().catch((e) => cronLog.error('fetchRecipePrices failed:', e));
}, 15 * 60_000);

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
