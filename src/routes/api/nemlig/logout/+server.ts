import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	for (const cookie of cookies.getAll()) {
		cookies.delete(cookie.name, { path: '/' });
	}
	return json({ ok: true });
};
