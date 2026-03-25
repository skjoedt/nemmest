const LOGIN_CAPACITY = 3;
const LOGIN_REFILL_MS = 200_000; // 10 min / 3 tokens

let loginTokens = LOGIN_CAPACITY;
let loginLastRefill = Date.now();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

export function checkLoginLimit(): RateLimitResult {
	const now = Date.now();
	const refilled = Math.floor((now - loginLastRefill) / LOGIN_REFILL_MS);
	if (refilled > 0) {
		loginTokens = Math.min(LOGIN_CAPACITY, loginTokens + refilled);
		loginLastRefill += refilled * LOGIN_REFILL_MS;
	}
	if (loginTokens < 1) {
		return { ok: false, retryAfterMs: LOGIN_REFILL_MS - (now - loginLastRefill) };
	}
	loginTokens -= 1;
	return { ok: true };
}

const BURST_MAX = 10;
const BURST_WINDOW_MS = 3_000;

let burstCount = 0;
let burstWindowStart = Date.now();

export function checkBurstLimit(): RateLimitResult {
	const now = Date.now();
	if (now - burstWindowStart > BURST_WINDOW_MS) {
		burstCount = 0;
		burstWindowStart = now;
	}
	if (burstCount >= BURST_MAX) {
		return { ok: false, retryAfterMs: BURST_WINDOW_MS - (now - burstWindowStart) };
	}
	burstCount += 1;
	return { ok: true };
}
