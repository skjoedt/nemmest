import type { Cookies } from '@sveltejs/kit';

export const NEMLIG_BASE_URL = 'https://www.nemlig.com/webapi';

// All nemlig session cookies are stored together in a single app-owned cookie.
export const NEMLIG_SESSION_COOKIE = 'nemlig_session';

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

// Parses all Set-Cookie headers from a nemlig response and stores the resulting
// name→value pairs as a single JSON blob in an HttpOnly app-owned cookie.
export function forwardCookies(response: Response, cookies: Cookies): void {
	const h = response.headers as unknown as { getSetCookie?: () => string[] };
	const raw = typeof h.getSetCookie === 'function'
		? h.getSetCookie()
		: (response.headers.get('set-cookie') ?? '').split(/,\s*(?=[^;,]+=)/).filter(Boolean);

	const session: Record<string, string> = {};

	for (const entry of raw) {
		const [nameValue] = entry.split(';');
		const eq = nameValue.indexOf('=');
		if (eq === -1) continue;
		const name = nameValue.slice(0, eq).trim();
		const value = nameValue.slice(eq + 1).trim();
		session[name] = value;
	}

	if (Object.keys(session).length > 0) {
		cookies.set(NEMLIG_SESSION_COOKIE, JSON.stringify(session), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
		});
	}
}

// Returns the nemlig session cookies as an upstream Cookie header string,
// or null if no session exists.
export function getNemligCookieHeader(cookies: Cookies): string | null {
	const raw = cookies.get(NEMLIG_SESSION_COOKIE);
	if (!raw) return null;
	const session = JSON.parse(raw) as Record<string, string>;
	const header = Object.entries(session).map(([k, v]) => `${k}=${v}`).join('; ');
	return header || null;
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
