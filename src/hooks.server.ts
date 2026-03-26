import type { Handle } from '@sveltejs/kit';
import { logger } from '$lib/logger';

const log = logger.withTag('request');

// Extensions that are never interesting to log
const STATIC_EXT = /\.(js|css|ico|png|jpg|jpeg|svg|woff2?|ttf|map)$/i;

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
