import { db } from '$lib/db.js';
import { userSettings } from '$lib/schema.js';

/** Loads all user settings as a key→value map. Server-only. */
export async function getSettings(): Promise<Record<string, string>> {
	const rows = await db.select().from(userSettings);
	const map: Record<string, string> = {};
	for (const row of rows) {
		map[row.key] = row.value;
	}
	return map;
}
