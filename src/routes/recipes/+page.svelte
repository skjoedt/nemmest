<script lang="ts">
	import { onMount } from 'svelte';
	import SearchRecipeCard from '$lib/components/SearchRecipeCard.svelte';
	import FavoriteRecipeCard from '$lib/components/FavoriteRecipeCard.svelte';
	import type { NemligRecipe, FavoriteRecipe, RecipeSortOrder } from '$lib/types';
	import type { PageData } from './$types';
	import { parsePersonsSetting, parseSortOrderSetting } from '$lib/settings';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	let searchResults = $state<NemligRecipe[]>([]);
	let numFound = $state(0);
	let favorites = $state<FavoriteRecipe[]>(data.favorites);
	let favoriteIds = $derived(new Set(favorites.map((f) => f.recipeId)));

	type SearchStatus = 'idle' | 'loading' | 'error' | 'done';
	let searchStatus = $state<SearchStatus>('idle');
	let searchError = $state('');
	let basketAvailable = $state(false);

	let persons = $state(parsePersonsSetting(data.settings));
	let defaultSortOrder = $state<RecipeSortOrder>(parseSortOrderSetting(data.settings));

	onMount(() => { checkBasketAvailable(); });

	// ── Search ────────────────────────────────────────────────────────────────

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
			const res = await fetch(`/api/recipes/search?q=${encodeURIComponent(query.trim())}`);
			const body = await res.json() as { recipes?: NemligRecipe[]; numFound?: number; error?: string };
			if (!res.ok) { searchError = body.error ?? `Error ${res.status}`; searchStatus = 'error'; return; }
			searchResults = body.recipes ?? [];
			numFound = body.numFound ?? searchResults.length;
			searchStatus = 'done';
		} catch {
			searchError = 'Search failed. Check your connection and try again.';
			searchStatus = 'error';
		}
	}

	// ── Favorites ────────────────────────────────────────────────────────────

	async function toggleFavorite(recipe: NemligRecipe | FavoriteRecipe) {
		const id = 'recipeId' in recipe ? recipe.recipeId : recipe.id;

		if (favoriteIds.has(id)) {
			favorites = favorites.filter((f) => f.recipeId !== id);
			await fetch(`/api/recipes/favorites?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
		} else {
			const res = await fetch('/api/recipes/favorites', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					recipeId: id,
					name: recipe.name,
					description: recipe.description ?? undefined,
					imageUrl: recipe.imageUrl ?? undefined,
					preparationTime: recipe.preparationTime ?? undefined,
					url: recipe.url ?? undefined,
					sortOrder: defaultSortOrder,
					persons,
				}),
			});
			if (res.ok) {
				const fav = await res.json() as FavoriteRecipe;
				favorites = [...favorites, fav];
			}
		}
	}

	// ── Basket ────────────────────────────────────────────────────────────────

	async function checkBasketAvailable() {
		try {
			const res = await fetch('/api/nemlig/session');
			basketAvailable = res.ok;
		} catch {
			basketAvailable = false;
		}
	}

	async function addRecipeToBasket(recipe: FavoriteRecipe): Promise<void> {
		const anchor = recipe.anchorProductSelectionId;
		if (!anchor) throw new Error('No anchor product selection ID');

		const activeIngredients = recipe.ingredients.filter((i) => !i.isDeselected);

		if (activeIngredients.length === 0) throw new Error('No active ingredients');

		const selectedProducts = activeIngredients.map((i) => ({
			ProductSelectionId: anchor,
			ProductSelectionName: i.productName,
			ProductId: i.productId,
			Quantity: i.quantity,
		}));

		const res = await fetch('/api/nemlig/basket/AddRecipeToBasket', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				RecipeId: recipe.recipeId,
				NumberOfPeople: '1',
				Sorting: 'default',
				SelectedProducts: selectedProducts,
				SoldoutProducts: [],
				SupplementProducts: [],
			}),
		});

		if (!res.ok) throw new Error(`HTTP ${res.status}`);
	}
</script>

<div class="py-6 space-y-8">

	<div>
		<h1 class="text-xl font-semibold text-zinc-900">Recipes</h1>
		<p class="mt-1 text-sm text-zinc-500">Search for recipes on nemlig.com and save your favorites.</p>
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
			placeholder="Search recipes on nemlig.com…"
			autocomplete="off"
			class="block w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm
				text-zinc-900 placeholder:text-zinc-400 shadow-sm
				focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
		/>
	</div>

	{#if searchStatus === 'error'}
		<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{searchError}
		</div>
	{/if}

	<!-- Search results -->
	{#if searchStatus === 'done' && searchResults.length > 0}
		<section>
			<div class="mb-3 flex items-baseline justify-between">
				<h2 class="text-sm font-medium text-zinc-900">Search results</h2>
				<span class="text-xs text-zinc-400">{numFound} recipes found</span>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
				{#each searchResults as recipe (recipe.id)}
				<SearchRecipeCard
					{recipe}
					isFavorite={favoriteIds.has(recipe.id)}
					onToggleFavorite={toggleFavorite}
				/>
				{/each}
			</div>
		</section>
	{:else if searchStatus === 'done' && query.trim().length >= 2}
		<p class="text-sm text-zinc-500">No recipes found for "<strong>{query}</strong>".</p>
	{/if}

	{#if (searchStatus === 'done' && searchResults.length > 0) && favorites.length > 0}
		<hr class="border-zinc-200" />
	{/if}

	<!-- Favorites -->
	<section>
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="text-sm font-medium text-zinc-900">My favorites</h2>
			<span class="text-xs text-zinc-400">{favorites.length} recipes</span>
		</div>

		{#if favorites.length === 0}
			<div class="rounded-xl border border-dashed border-zinc-200 px-6 py-10 text-center">
				<svg class="mx-auto size-8 text-zinc-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
				</svg>
				<p class="text-sm text-zinc-400">No favorites yet.<br/>Search for recipes and click the heart to add them.</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
				{#each favorites as fav (fav.recipeId)}
					<FavoriteRecipeCard
						recipe={fav}
						{basketAvailable}
						onToggleFavorite={toggleFavorite}
						onAddToBasket={addRecipeToBasket}
					/>
				{/each}
			</div>
		{/if}
	</section>
</div>
