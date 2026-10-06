import { access, chmod, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stateDirectory = join(repositoryRoot, '.nemmest-live-session');

export const authStatePath = process.env.NEMMEST_LIVE_SESSION_STATE ?? join(stateDirectory, 'auth.json');
export const baseUrl = process.env.NEMMEST_BASE_URL ?? 'http://127.0.0.1:5173';

export function assertLoopbackUrl(value = baseUrl) {
	const hostname = new URL(value).hostname;
	if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
		throw new Error('NEMMEST_BASE_URL must use localhost, 127.0.0.1, or ::1.');
	}
}

export async function ensureStateDirectory() {
	const directory = dirname(authStatePath);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	await chmod(directory, 0o700);
}

export async function requireAuthState() {
	try {
		await access(authStatePath);
	} catch {
		throw new Error(`No live session found at ${authStatePath}. Run npm run live:login first.`);
	}
}

export async function persistStorageState(context) {
	await ensureStateDirectory();
	await context.storageState({ path: authStatePath });
	await chmod(authStatePath, 0o600);
}
