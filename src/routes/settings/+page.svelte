<script lang="ts">
	import { Circle, Star, PiggyBank, Leaf } from 'lucide-svelte';
	import type { RecipeSortOrder } from '$lib/types';
	import { parsePersonsSetting, parseSortOrderSetting } from '$lib/settings';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let connected = $state<boolean | null>(data.connected);
	let status = $state<'idle' | 'loading' | 'error'>('idle');
	let errorMessage = $state('');

	let username = $state('');
	let password = $state('');

	let persons = $state(parsePersonsSetting(data.settings));
	let defaultSortOrder = $state<RecipeSortOrder>(parseSortOrderSetting(data.settings));

	// Tracks which setting keys were just saved (for checkmark flash)
	let saved = $state(new Set<string>());
	let saving = $state(new Set<string>());

	type SortOption = { value: RecipeSortOrder; label: string; icon: typeof Circle };
	const sortOptions: SortOption[] = [
		{ value: 'default',     label: 'Default',     icon: Circle   },
		{ value: 'recommended', label: 'Recommended', icon: Star     },
		{ value: 'priceasc',    label: 'Cheapest',    icon: PiggyBank },
		{ value: 'organic',     label: 'Organic',     icon: Leaf     },
	];

	async function saveSetting(key: string, value: string) {
		saving = new Set([...saving, key]);
		saved = new Set([...saved].filter((k) => k !== key));
		try {
			await fetch('/api/settings', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ key, value }),
			});
			saved = new Set([...saved, key]);
			setTimeout(() => { saved = new Set([...saved].filter((k) => k !== key)); }, 2000);
		} finally {
			saving = new Set([...saving].filter((k) => k !== key));
		}
	}

	function savePersons(newValue: number) {
		persons = newValue;
		saveSetting('persons', String(newValue));
	}

	function saveDefaultSortOrder(newValue: RecipeSortOrder) {
		defaultSortOrder = newValue;
		saveSetting('defaultSortOrder', newValue);
	}

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

	type JobStatus = 'idle' | 'running' | 'done' | 'error';
	let jobStatus = $state<JobStatus>('idle');

	const jobButtonClass = $derived.by(() => {
		switch (jobStatus) {
			case 'done': return 'bg-green-600 text-white';
			case 'error': return 'bg-red-500 text-white';
			default: return 'bg-zinc-900 text-white hover:bg-zinc-700';
		}
	});

	async function runPriceFetch() {
		if (jobStatus === 'running') return;
		jobStatus = 'running';
		try {
			const res = await fetch('/api/workers/fetch-recipe-prices', { method: 'POST' });
			jobStatus = res.ok ? 'done' : 'error';
		} catch {
			jobStatus = 'error';
		} finally {
			setTimeout(() => { jobStatus = 'idle'; }, 4000);
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
			<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
				{connected ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}">
				{connected ? 'connected' : 'not connected'}
			</span>
		</div>

		{#if connected}
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

	<section class="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
		<div class="px-5 py-4">
			<h2 class="text-sm font-medium text-zinc-900">Search settings</h2>
			<p class="mt-0.5 text-xs text-zinc-500">Applied when searching for recipes and when adding a recipe to favorites for the first time.</p>
		</div>

		<div class="px-5 py-4 flex items-center justify-between gap-4">
			<div>
				<label class="block text-sm font-medium text-zinc-700" for="persons">
					Number of people
				</label>
				<p class="text-xs text-zinc-400 mt-0.5">Used to scale ingredient quantities when favoriting a recipe.</p>
			</div>
			<div class="flex items-center gap-2">
				<select
					id="persons"
					value={persons}
					onchange={(e) => savePersons(parseInt((e.target as HTMLSelectElement).value, 10))}
					disabled={saving.has('persons')}
					class="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900
						focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200
						disabled:opacity-50"
				>
					{#each Array.from({ length: 10 }, (_, i) => i + 1) as n}
						<option value={n} selected={n === persons}>{n} {n === 1 ? 'person' : 'people'}</option>
					{/each}
				</select>
				{#if saved.has('persons')}
					<svg class="size-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
				{/if}
			</div>
		</div>

		<div class="px-5 py-4 flex items-center justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-zinc-700">Default sort order</p>
				<p class="text-xs text-zinc-400 mt-0.5">Ingredient sort order used when favoriting a recipe and for search result price display.</p>
			</div>
			<div class="flex items-center gap-2">
				<div class="flex rounded-lg border border-zinc-200 overflow-hidden">
					{#each sortOptions as opt (opt.value)}
						<button
							type="button"
							onclick={() => saveDefaultSortOrder(opt.value)}
							title={opt.label}
							aria-label={opt.label}
							disabled={saving.has('defaultSortOrder')}
							class="p-2 transition-colors
								{defaultSortOrder === opt.value
									? 'bg-zinc-900 text-white'
									: 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700'}
								disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<opt.icon size={15} strokeWidth={2} />
						</button>
					{/each}
				</div>
				{#if saved.has('defaultSortOrder')}
					<svg class="size-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
				{/if}
			</div>
		</div>
	</section>

	<section class="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
		<div class="px-5 py-4">
			<h2 class="text-sm font-medium text-zinc-900">Price history</h2>
			<p class="mt-0.5 text-xs text-zinc-500">Prices for favorited recipes are recorded automatically at 06:00 every day.</p>
		</div>
		<div class="px-5 py-4 flex items-center justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-zinc-700">Fetch prices now</p>
				<p class="text-xs text-zinc-400 mt-0.5">Run the price fetch job immediately for all favorited recipes.</p>
			</div>
			<button
				type="button"
				onclick={runPriceFetch}
				disabled={jobStatus === 'running'}
				class="shrink-0 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
					transition-colors disabled:cursor-not-allowed disabled:opacity-50
					{jobButtonClass}"
			>
				{#if jobStatus === 'running'}
					<svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
					</svg>
					Fetching…
				{:else if jobStatus === 'done'}
					<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
					Done
				{:else if jobStatus === 'error'}
					<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 9v4M12 17h.01"/>
						<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
					</svg>
					Failed
				{:else}
					<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
					</svg>
					Fetch prices now
				{/if}
			</button>
		</div>
	</section>
</div>
