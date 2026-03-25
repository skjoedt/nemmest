import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NEMLIG_SESSION_COOKIE } from '$lib/nemlig';

export const GET: RequestHandler = ({ cookies }) => {
	const raw = cookies.get(NEMLIG_SESSION_COOKIE);
	const authenticated = !!raw && !!JSON.parse(raw)['.ASPXAUTH'];

	if (!authenticated) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	return json({ ok: true });
};
