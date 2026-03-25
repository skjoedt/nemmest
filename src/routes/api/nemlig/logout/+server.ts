import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NEMLIG_SESSION_COOKIE } from '$lib/server/nemlig';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete(NEMLIG_SESSION_COOKIE, { path: '/' });
	return json({ ok: true });
};
