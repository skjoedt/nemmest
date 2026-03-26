<script lang="ts">
	import { onMount } from 'svelte';
	import RecipeCard from '$lib/components/RecipeCard.svelte';
	import type { NemligRecipe, FavoriteRecipe, RecipeSortOrder } from '$lib/types';
	import { VALID_SORT_ORDERS } from '$lib/types';
	import type { PageData } from './$types';

	// ── Props ─────────────────────────────────────────────────────────────────

	let { data }: { data: PageData } = $props();

	// ── State ────────────────────────────────────────────────────────────────

	let query = $state('');
	let searchResults = $state<NemligRecipe[]>([]);
	let numFound = $state(0);
	// Initialised from server-loaded data — no client-side fetch needed
	let favorites = $state<FavoriteRecipe[]>(data.favorites);
	let favoriteIds = $derived(new Set(favorites.map((f) => f.recipeId)));

	type SearchStatus = 'idle' | 'loading' | 'error' | 'done';
	let searchStatus = $state<SearchStatus>('idle');
	let searchError = $state('');
	let basketAvailable = $state(false);

	// Initialise settings from server-loaded data
	let persons = $state(
		data.settings.persons
			? Math.min(10, Math.max(1, parseInt(data.settings.persons, 10)))
			: 4
	);
	let defaultSortOrder = $state<RecipeSortOrder>(
		data.settings.defaultSortOrder && VALID_SORT_ORDERS.has(data.settings.defaultSortOrder as RecipeSortOrder)
			? (data.settings.defaultSortOrder as RecipeSortOrder)
			: 'default'
	);
	let showOptionalIngredients = $state(
		data.settings.showOptionalIngredients !== undefined
			? data.settings.showOptionalIngredients !== 'false'
			: true
	);

	// ── Ephemeral deselection + sort order state for search results ─────────
	// Maps recipeId → Set<productSelectionId> for non-favorited search results.
	// Carried over when a recipe is favorited.
	let searchDeselected = $state(new Map<string, Set<string>>());
	let searchSortOrder = $state(new Map<string, RecipeSortOrder>());

	// ── Lifecycle ────────────────────────────────────────────────────────────

	onMount(() => {
		checkBasketAvailable();
	});

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
			const res = await fetch(`/api/recipes/search?q=${encodeURIComponent(query.trim())}`);
			const data = await res.json() as {
				recipes?: NemligRecipe[];
				numFound?: number;
				error?: string;
			};

			if (!res.ok) {
				searchError = data.error ?? `Error ${res.status}`;
				searchStatus = 'error';
				return;
			}

			searchResults = data.recipes ?? [];
			numFound = data.numFound ?? searchResults.length;
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
			// Carry over any deselections + sort order made while browsing search results
			const ephemeralDeselected = searchDeselected.get(id);
			const deselectedIngredientIds = ephemeralDeselected ? [...ephemeralDeselected] : [];
			const sortOrder = searchSortOrder.get(id) ?? 'default';

			const fav: FavoriteRecipe = {
				recipeId: id,
				name: recipe.name,
				description: recipe.description ?? null,
				imageUrl: recipe.imageUrl ?? null,
				preparationTime: recipe.preparationTime ?? null,
				url: recipe.url ?? null,
				sortOrder,
				deselectedIngredientIds,
			};
			favorites = [...favorites, fav];
			await fetch('/api/recipes/favorites', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					recipeId: id,
					name: recipe.name,
					description: recipe.description ?? undefined,
					imageUrl: recipe.imageUrl ?? undefined,
					preparationTime: recipe.preparationTime ?? undefined,
					url: recipe.url ?? undefined,
					sortOrder,
					deselectedIngredientIds,
				}),
			});
		}
	}

	// ── Deselection + sort order persistence ─────────────────────────────────
	//
	// One debounce timer per recipe. Both deselection and sort-order changes
	// update the local favorites state immediately and schedule a single
	// upsert that writes the latest values of both dimensions.

	const prefTimers = new Map<string, ReturnType<typeof setTimeout>>();

	function schedulePersist(recipeId: string) {
		const prev = prefTimers.get(recipeId);
		if (prev) clearTimeout(prev);
		prefTimers.set(
			recipeId,
			setTimeout(() => {
				prefTimers.delete(recipeId);
				persistFavoritePrefs(recipeId);
			}, 600)
		);
	}

	function onDeselectionChange(recipeId: string, deselectedIds: string[]) {
		if (favoriteIds.has(recipeId)) {
			favorites = favorites.map((f) =>
				f.recipeId === recipeId ? { ...f, deselectedIngredientIds: deselectedIds } : f
			);
			schedulePersist(recipeId);
		} else {
			// Search result — keep in ephemeral map
			const next = new Map(searchDeselected);
			next.set(recipeId, new Set(deselectedIds));
			searchDeselected = next;
		}
	}

	// ── Sort order ────────────────────────────────────────────────────────────

	function onSortOrderChange(recipeId: string, newSortOrder: RecipeSortOrder) {
		if (favoriteIds.has(recipeId)) {
			favorites = favorites.map((f) =>
				f.recipeId === recipeId ? { ...f, sortOrder: newSortOrder } : f
			);
			schedulePersist(recipeId);
		} else {
			// Search result — keep in ephemeral map
			const next = new Map(searchSortOrder);
			next.set(recipeId, newSortOrder);
			searchSortOrder = next;
		}
	}

	async function persistFavoritePrefs(recipeId: string) {
		const fav = favorites.find((f) => f.recipeId === recipeId);
		if (!fav) return;
		await fetch('/api/recipes/favorites', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				recipeId: fav.recipeId,
				name: fav.name,
				description: fav.description ?? undefined,
				imageUrl: fav.imageUrl ?? undefined,
				preparationTime: fav.preparationTime ?? undefined,
				url: fav.url ?? undefined,
				sortOrder: fav.sortOrder ?? 'default',
				deselectedIngredientIds: fav.deselectedIngredientIds ?? [],
			}),
		});
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

	/**
	 * Add a single recipe directly to the nemlig basket using the AddRecipeToBasket endpoint.
	 * Called by RecipeCard after the user confirms persons count.
	 */
	async function addRecipeToBasket(
		recipe: NemligRecipe | FavoriteRecipe,
		sortOrder: RecipeSortOrder,
		selectedProducts: { ProductSelectionId: string; ProductSelectionName: string; ProductId: string; Quantity: number }[],
		numPersons: number,
	): Promise<void> {
		const id = 'recipeId' in recipe ? recipe.recipeId : recipe.id;

		const res = await fetch('/api/nemlig/basket/AddRecipeToBasket', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				RecipeId: id,
				NumberOfPeople: String(numPersons),
				Sorting: sortOrder,
				SelectedProducts: selectedProducts,
				SoldoutProducts: [],
				SupplementProducts: [],
			}),
		});

		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
	}
</script>

<div class="py-6 space-y-8">

	<!-- Page header -->
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
				<h2 class="text-sm font-medium text-zinc-900">Search results</h2>
				<span class="text-xs text-zinc-400">{numFound} recipes found</span>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
				{#each searchResults as recipe (recipe.id)}
					<RecipeCard
						{recipe}
						{persons}
						isFavorite={favoriteIds.has(recipe.id)}
						deselectedIngredientIds={[...(searchDeselected.get(recipe.id) ?? [])]}
						initialSortOrder={defaultSortOrder}
						{showOptionalIngredients}
						{basketAvailable}
						onToggleFavorite={toggleFavorite}
						onAddToBasket={addRecipeToBasket}
						{onDeselectionChange}
						{onSortOrderChange}
					/>
				{/each}
			</div>
		</section>
	{:else if searchStatus === 'done' && query.trim().length >= 2}
		<p class="text-sm text-zinc-500">No recipes found for "<strong>{query}</strong>".</p>
	{/if}

	<!-- Divider when both sections visible -->
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
					<RecipeCard
						recipe={fav}
						{persons}
						isFavorite={true}
						deselectedIngredientIds={fav.deselectedIngredientIds ?? []}
						{showOptionalIngredients}
						{basketAvailable}
						onToggleFavorite={toggleFavorite}
						onAddToBasket={addRecipeToBasket}
						{onDeselectionChange}
						{onSortOrderChange}
					/>
				{/each}
			</div>
		{/if}
	</section>
</div>
