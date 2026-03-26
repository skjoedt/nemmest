import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { userSettings } from '$lib/schema';
import { NEMLIG_SESSION_COOKIE } from '$lib/nemlig';

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
	const settingRows = await db.select().from(userSettings);

	const settings: Record<string, string> = {};
	for (const row of settingRows) {
		settings[row.key] = row.value;
	}

	return {
		connected: isAuthenticated(cookies),
		settings,
	};
};
