import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NEMLIG_BASE_URL, NEMLIG_STATIC_HEADERS, forwardCookies } from '$lib/server/nemlig';
import { checkLoginLimit } from '$lib/server/rate-limit';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const reqBody = await request.json().catch(() => null) as {
		username?: unknown;
		password?: unknown;
	} | null;

	if (typeof reqBody?.username !== 'string' || !reqBody.username) error(400, 'username is required');
	if (typeof reqBody?.password !== 'string' || !reqBody.password) error(400, 'password is required');

	const limit = checkLoginLimit();
	if (!limit.ok) {
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
	} catch {
		error(502, 'Could not reach nemlig.com');
	}

	// Nemlig returns 400 with ErrorCode 4 for invalid credentials (not 401)
	if (nemligRes.status === 400 || nemligRes.status === 401 || nemligRes.status === 403) {
		const errBody = await nemligRes.json().catch(() => null) as { ErrorCode?: number } | null;
		if (nemligRes.status === 400 && errBody?.ErrorCode !== 4) {
			error(502, 'nemlig.com returned an unexpected error');
		}
		return json({ error: 'Invalid email or password' }, { status: 401 });
	}

	if (!nemligRes.ok) {
		error(502, 'nemlig.com returned an unexpected error');
	}

	forwardCookies(nemligRes, cookies);

	return json({ ok: true });
};
