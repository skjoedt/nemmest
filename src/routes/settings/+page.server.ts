import type { PageServerLoad } from './$types';
import { NEMLIG_SESSION_COOKIE } from '$lib/nemlig';
import { getSettings } from '$lib/server/settings';

function isAuthenticated(cookies: { get(name: string): string | undefined }): boolean {
	const raw = cookies.get(NEMLIG_SESSION_COOKIE);
	if (!raw) return false;
	try {
		return !!JSON.parse(raw)['.ASPXAUTH'];
	} catch {
		return false;
	}
}

export const load: PageServerLoad = async ({ cookies }) => {
	return {
		connected: isAuthenticated(cookies),
		settings: await getSettings(),
	};
};
