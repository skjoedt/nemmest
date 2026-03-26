import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NEMLIG_BASE_URL, NEMLIG_STATIC_HEADERS, forwardCookies } from '$lib/nemlig';
import { checkLoginLimit } from '$lib/rate-limit';
import { logger } from '$lib/logger';

const log = logger.withTag('nemlig/login');

export const POST: RequestHandler = async ({ request, cookies }) => {
	const reqBody = await request.json().catch(() => null) as {
		username?: unknown;
		password?: unknown;
	} | null;

	if (typeof reqBody?.username !== 'string' || !reqBody.username) error(400, 'username is required');
	if (typeof reqBody?.password !== 'string' || !reqBody.password) error(400, 'password is required');

	const limit = checkLoginLimit();
	if (!limit.ok) {
		log.warn('Login rate limit hit');
		return json(
			{ error: 'Too many login attempts. Please wait before trying again.' },
			{ status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
		);
	}

	const username: string = reqBody.username;
	const password: string = reqBody.password;

	let nemligRes: Response;
	try {
		nemligRes = await fetch(`${NEMLIG_BASE_URL}/login/login`, {
			method: 'POST',
			headers: { ...NEMLIG_STATIC_HEADERS, 'x-correlation-id': crypto.randomUUID() },
			body: JSON.stringify({
				Username: username,
				Password: password,
				AppInstalled: false,
				AutoLogin: false,
				CheckForExistingProducts: true,
				DoMerge: true,
			}),
		});
	} catch (e) {
		log.error('Network error reaching nemlig.com:', e);
		error(502, 'Could not reach nemlig.com');
	}

	// Nemlig returns 400 with ErrorCode 4 for invalid credentials (not 401)
	if (nemligRes.status === 400 || nemligRes.status === 401 || nemligRes.status === 403) {
		const errBody = await nemligRes.json().catch(() => null) as { ErrorCode?: number } | null;
		if (nemligRes.status === 400 && errBody?.ErrorCode !== 4) {
			log.error(`Unexpected login error ${nemligRes.status}, ErrorCode=${errBody?.ErrorCode}`);
			error(502, 'nemlig.com returned an unexpected error');
		}
		log.warn(`Failed login attempt for user (status ${nemligRes.status})`);
		return json({ error: 'Invalid email or password' }, { status: 401 });
	}

	if (!nemligRes.ok) {
		log.error(`Unexpected login error ${nemligRes.status}`);
		error(502, 'nemlig.com returned an unexpected error');
	}

	forwardCookies(nemligRes, cookies);

	log.info('Login successful');
	return json({ ok: true });
};
