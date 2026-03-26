<script lang="ts">
	import { Circle, Star, PiggyBank, Leaf } from 'lucide-svelte';
	import type { RecipeSortOrder } from '$lib/types';
	import { VALID_SORT_ORDERS } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// ── Nemlig connection ─────────────────────────────────────────────────────
	// Initial value from SSR; updated client-side after connect/disconnect.
	let connected = $state<boolean | null>(data.connected);
	let status = $state<'idle' | 'loading' | 'error'>('idle');
	let errorMessage = $state('');

	let username = $state('');
	let password = $state('');

	// ── Recipe persons setting ───────────────────────────────────────────────
	let persons = $state(
		data.settings.persons
			? Math.min(10, Math.max(1, parseInt(data.settings.persons, 10)))
			: 4
	);
	let personsSaving = $state(false);
	let personsSaved = $state(false);

	// ── Default sort order setting ───────────────────────────────────────────
	let defaultSortOrder = $state<RecipeSortOrder>(
		data.settings.defaultSortOrder && VALID_SORT_ORDERS.has(data.settings.defaultSortOrder as RecipeSortOrder)
			? (data.settings.defaultSortOrder as RecipeSortOrder)
			: 'default'
	);
	let sortOrderSaving = $state(false);
	let sortOrderSaved = $state(false);

	// ── Show optional ingredients setting ───────────────────────────────────
	let showOptionalIngredients = $state(
		data.settings.showOptionalIngredients !== undefined
			? data.settings.showOptionalIngredients !== 'false'
			: true
	);
	let optionalSaving = $state(false);
	let optionalSaved = $state(false);

	type SortOption = { value: RecipeSortOrder; label: string; icon: typeof Circle };
	const sortOptions: SortOption[] = [
		{ value: 'default',     label: 'Default',     icon: Circle   },
		{ value: 'recommended', label: 'Recommended', icon: Star     },
		{ value: 'priceasc',    label: 'Cheapest',    icon: PiggyBank },
		{ value: 'organic',     label: 'Organic',     icon: Leaf     },
	];

	async function saveSetting(key: string, value: string) {
		await fetch('/api/settings', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key, value }),
		});
	}

	async function savePersons(newValue: number) {
		persons = newValue;
		personsSaving = true;
		personsSaved = false;
		try {
			await saveSetting('persons', String(newValue));
			personsSaved = true;
			setTimeout(() => { personsSaved = false; }, 2000);
		} finally {
			personsSaving = false;
		}
	}

	async function saveDefaultSortOrder(newValue: RecipeSortOrder) {
		defaultSortOrder = newValue;
		sortOrderSaving = true;
		sortOrderSaved = false;
		try {
			await saveSetting('defaultSortOrder', newValue);
			sortOrderSaved = true;
			setTimeout(() => { sortOrderSaved = false; }, 2000);
		} finally {
			sortOrderSaving = false;
		}
	}

	async function saveShowOptional(newValue: boolean) {
		showOptionalIngredients = newValue;
		optionalSaving = true;
		optionalSaved = false;
		try {
			await saveSetting('showOptionalIngredients', String(newValue));
			optionalSaved = true;
			setTimeout(() => { optionalSaved = false; }, 2000);
		} finally {
			optionalSaving = false;
		}
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

	<!-- Recipes settings -->
	<section class="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
		<div class="px-5 py-4">
			<h2 class="text-sm font-medium text-zinc-900">Recipes</h2>
			<p class="mt-0.5 text-xs text-zinc-500">Settings for recipe display and ingredient sorting.</p>
		</div>

		<!-- Number of people -->
		<div class="px-5 py-4 flex items-center justify-between gap-4">
			<div>
				<label class="block text-sm font-medium text-zinc-700" for="persons">
					Number of people
				</label>
				<p class="text-xs text-zinc-400 mt-0.5">Used to adjust ingredient quantities.</p>
			</div>
			<div class="flex items-center gap-2">
				<select
					id="persons"
					value={persons}
					onchange={(e) => savePersons(parseInt((e.target as HTMLSelectElement).value, 10))}
					disabled={personsSaving}
					class="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900
						focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200
						disabled:opacity-50"
				>
					{#each Array.from({ length: 10 }, (_, i) => i + 1) as n}
						<option value={n} selected={n === persons}>{n} {n === 1 ? 'person' : 'people'}</option>
					{/each}
				</select>
				{#if personsSaved}
					<svg class="size-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
				{/if}
			</div>
		</div>

		<!-- Default sort order (search results only) -->
		<div class="px-5 py-4 flex items-center justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-zinc-700">Default sort order</p>
				<p class="text-xs text-zinc-400 mt-0.5">Applied to new search results. Favorites use their own saved order.</p>
			</div>
			<div class="flex items-center gap-2">
				<div class="flex rounded-lg border border-zinc-200 overflow-hidden">
					{#each sortOptions as opt (opt.value)}
						<button
							type="button"
							onclick={() => saveDefaultSortOrder(opt.value)}
							title={opt.label}
							aria-label={opt.label}
							disabled={sortOrderSaving}
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
				{#if sortOrderSaved}
					<svg class="size-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
				{/if}
			</div>
		</div>

		<!-- Show optional ingredients -->
		<div class="px-5 py-4 flex items-center justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-zinc-700">Show optional ingredients</p>
				<p class="text-xs text-zinc-400 mt-0.5">Display supplementary ingredients in recipe cards.</p>
			</div>
			<div class="flex items-center gap-2">
				<!-- Toggle switch -->
				<button
					type="button"
					role="switch"
					aria-checked={showOptionalIngredients}
					aria-label="Show optional ingredients"
					onclick={() => saveShowOptional(!showOptionalIngredients)}
					disabled={optionalSaving}
					class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
						transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2
						{showOptionalIngredients ? 'bg-zinc-900' : 'bg-zinc-200'}
						disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<span
						class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
							ring-0 transition duration-200 ease-in-out
							{showOptionalIngredients ? 'translate-x-5' : 'translate-x-0'}"
					></span>
				</button>
				{#if optionalSaved}
					<svg class="size-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
				{/if}
			</div>
		</div>
	</section>
</div>
