import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NEMLIG_SESSION_COOKIE } from '$lib/nemlig';

export const GET: RequestHandler = ({ cookies }) => {
	const raw = cookies.get(NEMLIG_SESSION_COOKIE);
	let authenticated = false;
	if (raw) {
		try {
			authenticated = !!JSON.parse(raw)['.ASPXAUTH'];
		} catch {
			// A corrupt local session must not turn a status check into a server error.
		}
	}

	if (!authenticated) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	return json({ ok: true });
};
