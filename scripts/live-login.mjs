import { chromium } from 'playwright';
import { authStatePath, assertLoopbackUrl, baseUrl, ensureStateDirectory, persistStorageState } from './live-session.mjs';

assertLoopbackUrl();
await ensureStateDirectory();

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
let captured = false;

try {
	console.log(`Open settings in the browser and sign in. Session state will be saved to ${authStatePath}.`);
	await page.goto(new URL('/settings', baseUrl).toString(), { waitUntil: 'domcontentloaded' });

	const deadline = Date.now() + 10 * 60_000;
	while (Date.now() < deadline) {
		try {
			const response = await context.request.get(new URL('/api/nemlig/session', baseUrl).toString());
			if (response.ok()) {
				await persistStorageState(context);
				captured = true;
				console.log('Session captured. You can close the browser.');
				break;
			}
		} catch {
			// The local server can be restarting while the browser opens.
		}
		await page.waitForTimeout(1000);
	}
} finally {
	await browser.close();
}

if (!captured) throw new Error('Timed out waiting for a successful local session check.');
