import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NEMLIG_BASE_URL, buildUpstreamHeaders, getNemligCookieHeader, forwardCookies } from '$lib/server/nemlig';
import { checkBurstLimit } from '$lib/server/rate-limit';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE']);
const FORWARD_RESPONSE_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified'];

const handler: RequestHandler = async ({ request, params, cookies }) => {
	const limit = checkBurstLimit();
	if (!limit.ok) {
		return json(
			{ error: 'Too many requests', reason: 'rate_limited' },
			{ status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
		);
	}

	if (!ALLOWED_METHODS.has(request.method)) {
		error(405, `Method ${request.method} not allowed`);
	}

	const cookieHeader = getNemligCookieHeader(cookies);

	if (!cookieHeader) {
		return json({ error: 'Not authenticated', reason: 'unauthenticated' }, { status: 401 });
	}

	const upstreamUrl = new URL(`${NEMLIG_BASE_URL}/${params.path ?? ''}`);
	new URL(request.url).searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v));

	const hasBody = request.method !== 'GET' && request.method !== 'DELETE';
	const upstreamBody = hasBody ? await request.text() : undefined;

	let nemligRes: Response;
	try {
		nemligRes = await fetch(upstreamUrl.toString(), {
			method: request.method,
			headers: buildUpstreamHeaders(cookieHeader),
			body: upstreamBody,
		});
	} catch {
		error(502, 'Could not reach nemlig.com');
	}

	if (nemligRes.status === 401 || nemligRes.status === 403) {
		return json({ error: 'Nemlig session expired', reason: 'session_expired' }, { status: 401 });
	}

	if (!nemligRes.ok) {
		const text = await nemligRes.text().catch(() => '');
		return json(
			{ error: `nemlig.com error ${nemligRes.status}`, detail: text.slice(0, 500) },
			{ status: nemligRes.status },
		);
	}

	forwardCookies(nemligRes, cookies);

	const responseHeaders = new Headers();
	for (const name of FORWARD_RESPONSE_HEADERS) {
		const value = nemligRes.headers.get(name);
		if (value) responseHeaders.set(name, value);
	}

	return new Response(await nemligRes.text(), {
		status: nemligRes.status,
		headers: responseHeaders,
	});
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
