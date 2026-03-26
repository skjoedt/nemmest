import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NEMLIG_BASE_URL, buildUpstreamHeaders, getNemligCookieHeader, forwardCookies } from '$lib/nemlig';
import { checkBurstLimit } from '$lib/rate-limit';
import { logger } from '$lib/logger';

const log = logger.withTag('nemlig/proxy');

const FORWARD_RESPONSE_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified'];

const handler: RequestHandler = async ({ request, params, cookies }) => {
	const limit = checkBurstLimit();
	if (!limit.ok) {
		return json(
			{ error: 'Too many requests', reason: 'rate_limited' },
			{ status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
		);
	}

	const cookieHeader = getNemligCookieHeader(cookies);

	if (!cookieHeader) {
		return json({ error: 'Not authenticated', reason: 'unauthenticated' }, { status: 401 });
	}

	const upstreamUrl = new URL(`${NEMLIG_BASE_URL}/${params.path ?? ''}`);
	new URL(request.url).searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v));

	log.info(`${request.method} ${upstreamUrl}`);

	const hasBody = request.method !== 'GET' && request.method !== 'DELETE';
	const upstreamBody = hasBody ? await request.text() : undefined;

	if (upstreamBody) {
		log.debug('Request body:', upstreamBody);
	}

	let nemligRes: Response;
	try {
		nemligRes = await fetch(upstreamUrl.toString(), {
			method: request.method,
			headers: buildUpstreamHeaders(cookieHeader),
			body: upstreamBody,
		});
	} catch (e) {
		log.error('Network error reaching nemlig.com:', e);
		error(502, 'Could not reach nemlig.com');
	}

	if (nemligRes.status === 401 || nemligRes.status === 403) {
		log.warn(`Session expired or forbidden (${nemligRes.status})`);
		return json({ error: 'Nemlig session expired', reason: 'session_expired' }, { status: 401 });
	}

	const responseText = await nemligRes.text().catch(() => '');

	if (!nemligRes.ok) {
		log.error(`Upstream error ${nemligRes.status}:`, responseText.slice(0, 500));
		return json(
			{ error: `nemlig.com error ${nemligRes.status}`, detail: responseText.slice(0, 500) },
			{ status: nemligRes.status },
		);
	}

	log.debug(`Response ${nemligRes.status}:`, responseText.slice(0, 1000));

	forwardCookies(nemligRes, cookies);

	const responseHeaders = new Headers();
	for (const name of FORWARD_RESPONSE_HEADERS) {
		const value = nemligRes.headers.get(name);
		if (value) responseHeaders.set(name, value);
	}

	return new Response(responseText, {
		status: nemligRes.status,
		headers: responseHeaders,
	});
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
