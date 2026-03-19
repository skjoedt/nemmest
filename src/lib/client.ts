import type { Cookies } from '@sveltejs/kit';

export const NEMLIG_BASE_URL = 'https://www.nemlig.com/webapi';

export const NEMLIG_STATIC_HEADERS: Record<string, string> = {
	accept: 'application/json, text/plain, */*',
	'content-type': 'application/json',
	'device-size': 'desktop',
	platform: 'web',
	version: '11.233.0',
};

export class NemligAuthError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
		this.name = 'NemligAuthError';
	}
}

// Forwards all Set-Cookie headers from a Nemlig response into the browser via
// SvelteKit's cookies API. We only carry over the name=value pair — SvelteKit
// handles Secure (auto, based on environment) and we normalise everything else.
// Uses getSetCookie() (Node 18+/undici) when available; falls back to splitting
// the raw header on ", name=" boundaries.
export function forwardCookies(response: Response, cookies: Cookies): void {
	const h = response.headers as unknown as { getSetCookie?: () => string[] };
	const raw = typeof h.getSetCookie === 'function'
		? h.getSetCookie()
		: (response.headers.get('set-cookie') ?? '').split(/,\s*(?=[^;,]+=)/).filter(Boolean);

	for (const entry of raw) {
		const [nameValue] = entry.split(';');
		const eq = nameValue.indexOf('=');
		if (eq === -1) continue;
		const name = nameValue.slice(0, eq).trim();
		const value = nameValue.slice(eq + 1).trim();
		cookies.set(name, value, { path: '/', httpOnly: false, sameSite: 'lax' });
	}
}

export function buildUpstreamHeaders(
	cookieHeader: string | null,
	extra?: Record<string, string>,
): Record<string, string> {
	const headers: Record<string, string> = {
		...NEMLIG_STATIC_HEADERS,
		'x-correlation-id': crypto.randomUUID(),
		...extra,
	};
	if (cookieHeader) headers['cookie'] = cookieHeader;
	return headers;
}
