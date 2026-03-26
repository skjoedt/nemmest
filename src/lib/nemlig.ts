import type { Cookies } from '@sveltejs/kit';
import { logger } from '$lib/logger';

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

const log = logger.withTag('nemlig');

// Parses all Set-Cookie headers from a nemlig response and merges the resulting
// name→value pairs into the existing session blob in an HttpOnly app-owned cookie.
export function forwardCookies(response: Response, cookies: Cookies): void {
	const h = response.headers as unknown as { getSetCookie?: () => string[] };
	const raw = typeof h.getSetCookie === 'function'
		? h.getSetCookie()
		: (response.headers.get('set-cookie') ?? '').split(/,\s*(?=[^;,]+=)/).filter(Boolean);

	const incoming: Record<string, string> = {};

	for (const entry of raw) {
		const [nameValue] = entry.split(';');
		const eq = nameValue.indexOf('=');
		if (eq === -1) continue;
		const name = nameValue.slice(0, eq).trim();
		const value = nameValue.slice(eq + 1).trim();
		incoming[name] = value;
	}

	if (Object.keys(incoming).length === 0) return;

	// Merge into existing session so previously-set cookies (e.g. .ASPXAUTH) are preserved.
	let session: Record<string, string> = {};
	const existing = cookies.get(NEMLIG_SESSION_COOKIE);
	if (existing) {
		try {
			session = JSON.parse(existing);
		} catch (e) {
			log.error('Failed to parse nemlig_session cookie, resetting:', e);
		}
	}
	Object.assign(session, incoming);

	log.debug(`Forwarding cookies: ${Object.keys(incoming).join(', ')}`);

	cookies.set(NEMLIG_SESSION_COOKIE, JSON.stringify(session), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
	});
}

// Returns the nemlig session cookies as an upstream Cookie header string,
// or null if no session exists.
export function getNemligCookieHeader(cookies: Cookies): string | null {
	const raw = cookies.get(NEMLIG_SESSION_COOKIE);
	if (!raw) return null;
	let session: Record<string, string>;
	try {
		session = JSON.parse(raw) as Record<string, string>;
	} catch (e) {
		log.error('Failed to parse nemlig_session cookie:', e);
		return null;
	}
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
