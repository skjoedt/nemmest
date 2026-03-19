import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies }) => {
	const authenticated = !!cookies.get('.ASPXAUTH');

	if (!authenticated) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	return json({ ok: true });
};
