// Shared helpers for serialising/deserialising recipe ingredient-ID lists.
// These IDs are stored as a JSON array in a single text DB column.

/** Encode a string[] for storage in the `deselected_ingredient_ids` text column. */
export function encodeIds(ids: unknown): string | null {
	if (!Array.isArray(ids) || ids.length === 0) return null;
	return JSON.stringify(ids.filter((x) => typeof x === 'string'));
}

/** Decode the `deselected_ingredient_ids` text column back to string[]. */
export function decodeIds(raw: string | null | undefined): string[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === 'string') : [];
	} catch {
		return [];
	}
}
