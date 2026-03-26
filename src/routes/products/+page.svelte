<script lang="ts">
	import { onMount } from 'svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import type { NemligProduct, FavoriteProduct } from '$lib/types';

	// ── State ────────────────────────────────────────────────────────────────

	let query = $state('');
	let searchResults = $state<NemligProduct[]>([]);
	let numFound = $state(0);
	let favorites = $state<FavoriteProduct[]>([]);
	let favoriteIds = $derived(new Set(favorites.map((f) => f.productId)));

	type SearchStatus = 'idle' | 'loading' | 'error' | 'done';
	let searchStatus = $state<SearchStatus>('idle');
	let searchError = $state('');
	let favoritesLoading = $state(true);

	// ── Lifecycle ────────────────────────────────────────────────────────────

	onMount(loadFavorites);

	// ── Search (debounced) ───────────────────────────────────────────────────

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function onQueryInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (query.trim().length < 2) {
			searchResults = [];
			numFound = 0;
			searchStatus = 'idle';
			return;
		}
		debounceTimer = setTimeout(runSearch, 350);
	}

	async function runSearch() {
		searchStatus = 'loading';
		searchError = '';
		try {
			const res = await fetch(`/api/products/search?q=${encodeURIComponent(query.trim())}`);
			const data = await res.json() as {
				products?: NemligProduct[];
				numFound?: number;
				error?: string;
				reason?: string;
			};

			if (!res.ok) {
				if (data.reason === 'unauthenticated') {
					searchError = 'Not logged in to nemlig.com. Go to Settings and connect your account.';
				} else if (data.reason === 'session_expired') {
					searchError = 'Your nemlig.com session has expired. Go to Settings and reconnect.';
				} else {
					searchError = data.error ?? `Error ${res.status}`;
				}
				searchStatus = 'error';
				return;
			}

			searchResults = data.products ?? [];
			numFound = data.numFound ?? searchResults.length;
			searchStatus = 'done';
		} catch {
			searchError = 'Search failed. Check your connection and try again.';
			searchStatus = 'error';
		}
	}

	// ── Favorites ────────────────────────────────────────────────────────────

	async function loadFavorites() {
		favoritesLoading = true;
		try {
			const res = await fetch('/api/products/favorites');
			if (res.ok) {
				favorites = await res.json() as FavoriteProduct[];
			}
		} catch {
			// Non-critical — favorites just won't show
		} finally {
			favoritesLoading = false;
		}
	}

	async function toggleFavorite(product: NemligProduct | FavoriteProduct) {
		const productId: number = 'price' in product
			? parseInt(product.id, 10)
			: product.productId;

		if (favoriteIds.has(productId)) {
			// Remove
			favorites = favorites.filter((f) => f.productId !== productId);
			await fetch(`/api/products/favorites?id=${productId}`, { method: 'DELETE' });
		} else {
			// Add — build the FavoriteProduct shape
			const productUrl = 'url' in product ? product.url : null;
			const fav: FavoriteProduct = {
				productId,
				name: product.name,
				description: product.description ?? null,
				imageUrl: product.imageUrl ?? null,
				brand: product.brand ?? null,
				url: productUrl,
			};
			// Optimistic update
			favorites = [...favorites, fav];
			await fetch('/api/products/favorites', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					productId,
					name: product.name,
					description: product.description ?? undefined,
					imageUrl: product.imageUrl ?? undefined,
					brand: product.brand ?? undefined,
					url: productUrl ?? undefined,
				}),
			});
		}
	}
</script>

<div class="py-6 space-y-8">

	<!-- Page header -->
	<div>
		<h1 class="text-xl font-semibold text-zinc-900">Products</h1>
		<p class="mt-1 text-sm text-zinc-500">Search for products on nemlig.com and add them to your favorites.</p>
	</div>

	<!-- Search bar -->
	<div class="relative">
		<div class="pointer-events-none absolute inset-y-0 left-3 flex items-center">
			{#if searchStatus === 'loading'}
				<svg class="size-4 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
				</svg>
			{:else}
				<svg class="size-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="11" cy="11" r="8"/>
					<path d="m21 21-4.35-4.35"/>
				</svg>
			{/if}
		</div>
		<input
			type="search"
			bind:value={query}
			oninput={onQueryInput}
			placeholder="Search on nemlig.com…"
			autocomplete="off"
			class="block w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm
				text-zinc-900 placeholder:text-zinc-400 shadow-sm
				focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
		/>
	</div>

	<!-- Search error -->
	{#if searchStatus === 'error'}
		<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{searchError}
		</div>
	{/if}

	<!-- Search results -->
	{#if searchStatus === 'done' && searchResults.length > 0}
		<section>
			<div class="mb-3 flex items-baseline justify-between">
				<h2 class="text-sm font-medium text-zinc-900">
					Search results
				</h2>
				<span class="text-xs text-zinc-400">{numFound} products found</span>
			</div>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
				{#each searchResults as product (product.id)}
					<ProductCard
						{product}
						isFavorite={favoriteIds.has(parseInt(product.id, 10))}
						showPrice={true}
						onToggleFavorite={toggleFavorite}
					/>
				{/each}
			</div>
		</section>
	{:else if searchStatus === 'done' && query.trim().length >= 2}
		<p class="text-sm text-zinc-500">No products found for "<strong>{query}</strong>".</p>
	{/if}

	<!-- Divider when both sections visible -->
	{#if (searchStatus === 'done' && searchResults.length > 0) && favorites.length > 0}
		<hr class="border-zinc-200" />
	{/if}

	<!-- Favorites -->
	<section>
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="text-sm font-medium text-zinc-900">My favorites</h2>
			{#if !favoritesLoading}
				<span class="text-xs text-zinc-400">{favorites.length} products</span>
			{/if}
		</div>

		{#if favoritesLoading}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
				{#each Array(4) as _}
					<div class="rounded-xl border border-zinc-200 bg-zinc-50 aspect-[3/4] animate-pulse"></div>
				{/each}
			</div>
		{:else if favorites.length === 0}
			<div class="rounded-xl border border-dashed border-zinc-200 px-6 py-10 text-center">
				<svg class="mx-auto size-8 text-zinc-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
				</svg>
				<p class="text-sm text-zinc-400">No favorites yet.<br/>Search for products and click the heart to add them.</p>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
				{#each favorites as fav (fav.productId)}
					<ProductCard
						product={fav}
						isFavorite={true}
						showPrice={false}
						onToggleFavorite={toggleFavorite}
					/>
				{/each}
			</div>
		{/if}
	</section>
</div>
