import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { userSettings } from '$lib/schema';

// Keys that clients are permitted to read and write.
// Prevents arbitrary data accumulating in the settings table.
const ALLOWED_KEYS = new Set(['persons', 'defaultSortOrder']);

// GET /api/settings — return all settings as a key→value map
export const GET: RequestHandler = async () => {
	const rows = await db.select().from(userSettings);
	const map: Record<string, string> = {};
	for (const row of rows) {
		map[row.key] = row.value;
	}
	return json(map);
};

// POST /api/settings — upsert a setting
// Body: { key: string, value: string }
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null) as {
		key?: unknown;
		value?: unknown;
	} | null;

	if (typeof body?.key !== 'string' || !body.key.trim()) {
		return json({ error: 'key (string) is required' }, { status: 400 });
	}
	if (!ALLOWED_KEYS.has(body.key.trim())) {
		return json({ error: `Unknown setting key: ${body.key.trim()}` }, { status: 400 });
	}
	if (typeof body?.value !== 'string') {
		return json({ error: 'value (string) is required' }, { status: 400 });
	}

	await db
		.insert(userSettings)
		.values({ key: body.key.trim(), value: body.value })
		.onConflictDoUpdate({
			target: userSettings.key,
			set: { value: body.value },
		});

	return json({ ok: true });
};
