<script lang="ts">
	import { onMount } from 'svelte';

	let connected = $state<boolean | null>(null); // null = checking
	let status = $state<'idle' | 'loading' | 'error'>('idle');
	let errorMessage = $state('');

	let username = $state('');
	let password = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/api/nemlig/session');
			connected = res.ok;
		} catch {
			connected = false;
		}
	});

	async function connect() {
		if (!username.trim() || !password.trim()) {
			errorMessage = 'Enter your nemlig.com email and password.';
			status = 'error';
			return;
		}

		status = 'loading';
		errorMessage = '';

		try {
			const res = await fetch('/api/nemlig/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ username: username.trim(), password }),
			});

			const body = await res.json() as { error?: string };

			if (!res.ok) {
				throw new Error(body.error ?? `HTTP ${res.status}`);
			}

			password = '';
			connected = true;
			status = 'idle';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
			status = 'error';
		}
	}

	async function disconnect() {
		status = 'loading';
		try {
			await fetch('/api/nemlig/logout', { method: 'POST' });
		} finally {
			connected = false;
			username = '';
			password = '';
			status = 'idle';
		}
	}
</script>

<div class="py-8 space-y-8">
	<div>
		<h1 class="text-xl font-semibold text-zinc-900">Settings</h1>
		<p class="mt-1 text-sm text-zinc-500">Manage your nemlig.com connection.</p>
	</div>

	<section class="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
		<div class="px-5 py-4 flex items-center justify-between">
			<h2 class="text-sm font-medium text-zinc-900">nemlig.com account</h2>
			{#if connected !== null}
				<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
					{connected ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}">
					{connected ? 'connected' : 'not connected'}
				</span>
			{/if}
		</div>

		{#if connected === null}
			<div class="px-5 py-4">
				<p class="text-sm text-zinc-400">Checking connection…</p>
			</div>

		{:else if connected}
			<div class="px-5 py-4 flex items-center justify-between gap-4">
				<p class="text-sm text-zinc-400">
					Session cookies are stored in your browser. You will be prompted to
					reconnect if your session expires.
				</p>
				<button
					onclick={disconnect}
					disabled={status === 'loading'}
					class="shrink-0 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium
						text-zinc-700 transition-colors hover:bg-zinc-50
						disabled:cursor-not-allowed disabled:opacity-50"
				>
					{status === 'loading' ? 'Disconnecting…' : 'Disconnect'}
				</button>
			</div>

		{:else}
			<div class="px-5 py-4 space-y-3">
				<div class="space-y-1">
					<label class="block text-xs font-medium text-zinc-500" for="username">
						nemlig.com email
					</label>
					<input
						id="username"
						type="email"
						autocomplete="email"
						bind:value={username}
						placeholder="you@example.com"
						class="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm
							text-zinc-900 placeholder:text-zinc-400
							focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
					/>
				</div>

				<div class="space-y-1">
					<label class="block text-xs font-medium text-zinc-500" for="password">
						Password
					</label>
					<input
						id="password"
						type="password"
						autocomplete="current-password"
						bind:value={password}
						placeholder="••••••••"
						class="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm
							text-zinc-900 placeholder:text-zinc-400
							focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
					/>
				</div>
			</div>

			<div class="px-5 py-4 flex items-center justify-between gap-4">
				<div class="text-sm">
					{#if status === 'error'}
						<span class="text-red-600">{errorMessage}</span>
					{:else}
						<span class="text-zinc-400">
							Credentials are sent directly to nemlig.com and never stored on this server.
						</span>
					{/if}
				</div>

				<button
					onclick={connect}
					disabled={status === 'loading'}
					class="shrink-0 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2
						text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700
						disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if status === 'loading'}
						<svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none"
							stroke="currentColor" stroke-width="2">
							<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
								M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
						</svg>
						Connecting…
					{:else}
						Connect
					{/if}
				</button>
			</div>
		{/if}
	</section>
</div>
