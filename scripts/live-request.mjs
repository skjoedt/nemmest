import { readFile } from 'node:fs/promises';
import { request } from 'playwright';
import { assertLoopbackUrl, authStatePath, baseUrl, persistStorageState, requireAuthState } from './live-session.mjs';

function usage() {
	throw new Error(
		'Usage: npm run live:request -- <METHOD> </api/path> [--json <json> | --json-file <path>]',
	);
}

async function parseArguments() {
	const [rawMethod, rawPath, ...options] = process.argv.slice(2);
	if (!rawMethod || !rawPath) usage();

	const method = rawMethod.toUpperCase();
	if (!/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(method)) {
		throw new Error(`Unsupported HTTP method: ${rawMethod}`);
	}

	let jsonText;
	for (let index = 0; index < options.length; index += 2) {
		const option = options[index];
		const value = options[index + 1];
		if (!value || jsonText !== undefined) usage();
		if (option === '--json') jsonText = value;
		else if (option === '--json-file') jsonText = await readFile(value, 'utf8');
		else usage();
	}

	let data;
	if (jsonText !== undefined) {
		try {
			data = JSON.parse(jsonText);
		} catch {
			throw new Error('Request JSON is invalid.');
		}
	}

	return { method, rawPath, data };
}

assertLoopbackUrl();
const { method, rawPath, data } = await parseArguments();
const localOrigin = new URL(baseUrl).origin;
const target = new URL(rawPath, baseUrl);
if (target.origin !== localOrigin || !target.pathname.startsWith('/api/')) {
	throw new Error('Only local /api/... paths are allowed.');
}

await requireAuthState();
const api = await request.newContext({ baseURL: baseUrl, storageState: authStatePath });

try {
	const response = await api.fetch(`${target.pathname}${target.search}`, {
		method,
		data,
		headers: data === undefined ? undefined : { 'content-type': 'application/json' },
		maxRedirects: 0,
	});
	const headers = Object.entries(response.headers())
		.filter(([name]) => name.toLowerCase() !== 'set-cookie')
		.map(([name, value]) => `${name}: ${value}`)
		.join('\n');
	const body = await response.text();

	console.log(`HTTP ${response.status()} ${response.statusText()}`);
	if (headers) console.log(headers);
	if (body) process.stdout.write(`${body}${body.endsWith('\n') ? '' : '\n'}`);
	if (!response.ok()) process.exitCode = 1;
} finally {
	await persistStorageState(api);
	await api.dispose();
}
