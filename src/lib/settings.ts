import { db } from '$lib/db';
import { userSettings } from '$lib/schema';

export async function getSettings(): Promise<Record<string, string>> {
	const rows = await db.select().from(userSettings);
	return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Falls back to 4 (the UI default) if the setting is missing or invalid.
export function parsePersonsSetting(settings: Record<string, string>): number {
	const raw = parseInt(settings['persons'] ?? '', 10);
	return Math.min(10, Math.max(1, isNaN(raw) ? 4 : raw));
}
