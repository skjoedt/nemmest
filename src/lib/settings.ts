import { parseSortOrder, type RecipeSortOrder } from '$lib/types.js';

/** Falls back to 4 (the UI default) if the setting is missing or invalid. */
export function parsePersonsSetting(settings: Record<string, string>): number {
	const raw = parseInt(settings['persons'] ?? '', 10);
	return Math.min(10, Math.max(1, isNaN(raw) ? 4 : raw));
}

/** Falls back to 'default' if the setting is missing or invalid. */
export function parseSortOrderSetting(settings: Record<string, string>): RecipeSortOrder {
	return parseSortOrder(settings['defaultSortOrder']);
}
