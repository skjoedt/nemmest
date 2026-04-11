<script lang="ts">
	import type { FavoriteIngredient, FavoriteRecipe, NemligProduct } from '$lib/types';
	import IngredientRow from './IngredientRow.svelte';
	import PriceHistoryChart from './PriceHistoryChart.svelte';
	import { formatPrice, formatTime } from '$lib/format';

	interface Props {
		recipe: FavoriteRecipe;
		basketAvailable: boolean;
		onToggleFavorite: (recipe: FavoriteRecipe) => void;
		onAddToBasket: (recipe: FavoriteRecipe) => Promise<void>;
	}

	let { recipe, basketAvailable, onToggleFavorite, onAddToBasket }: Props = $props();

	let ingredients = $state<FavoriteIngredient[]>(recipe.ingredients);

	const activeTotal = $derived(
		ingredients
			.filter((i) => !i.isDeselected)
			.reduce((sum, i) => sum + i.price * i.quantity, 0)
	);

	let expanded = $state(false);
	let showPriceHistory = $state(false);

	// ── Add to basket ─────────────────────────────────────────────────────────

	type AddStatus = 'idle' | 'adding' | 'done' | 'error';
	let addStatus = $state<AddStatus>('idle');

	async function handleAddToBasket() {
		if (addStatus === 'adding') return;
		addStatus = 'adding';
		try {
			await onAddToBasket({ ...recipe, ingredients });
			addStatus = 'done';
			setTimeout(() => { addStatus = 'idle'; }, 2000);
		} catch {
			addStatus = 'error';
			setTimeout(() => { addStatus = 'idle'; }, 3000);
		}
	}

	// ── Ingredient editing ────────────────────────────────────────────────────

	async function toggleDeselect(ing: FavoriteIngredient) {
		const next = !ing.isDeselected;
		const res = await fetch('/api/recipes/ingredients', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id: ing.id, isDeselected: next }),
		});
		if (res.ok) {
			ingredients = ingredients.map((i) => i.id === ing.id ? { ...i, isDeselected: next } : i);
		}
	}

	let quantityTimers = new Map<number, ReturnType<typeof setTimeout>>();

	function onQuantityChange(ing: FavoriteIngredient, raw: string) {
		const val = parseInt(raw, 10);
		if (isNaN(val) || val < 1) return;
		ingredients = ingredients.map((i) => i.id === ing.id ? { ...i, quantity: val } : i);

		const prev = quantityTimers.get(ing.id);
		if (prev) clearTimeout(prev);
		quantityTimers.set(ing.id, setTimeout(async () => {
			quantityTimers.delete(ing.id);
			await fetch('/api/recipes/ingredients', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id: ing.id, quantity: val }),
			});
		}, 500));
	}

	async function removeIngredient(ing: FavoriteIngredient) {
		const res = await fetch(`/api/recipes/ingredients?id=${ing.id}`, { method: 'DELETE' });
		if (res.ok) {
			ingredients = ingredients.filter((i) => i.id !== ing.id);
		}
	}

	// ── Custom ingredient search ───────────────────────────────────────────────

	let searchQuery = $state('');
	let searchResults = $state<NemligProduct[]>([]);
	let searchStatus = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let searchDebounce: ReturnType<typeof setTimeout> | null = null;

	function onSearchInput() {
		if (searchDebounce) clearTimeout(searchDebounce);
		if (searchQuery.trim().length < 2) {
			searchResults = [];
			searchStatus = 'idle';
			return;
		}
		searchDebounce = setTimeout(runSearch, 350);
	}

	async function runSearch() {
		searchStatus = 'loading';
		try {
			const res = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery.trim())}`);
			if (!res.ok) { searchStatus = 'error'; return; }
			const data = await res.json() as { products: NemligProduct[] };
			searchResults = data.products ?? [];
			searchStatus = 'done';
		} catch {
			searchStatus = 'error';
		}
	}

	async function addCustomIngredient(product: NemligProduct) {
		const res = await fetch('/api/recipes/ingredients', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				recipeId: recipe.recipeId,
				productId: product.id,
				productName: product.name,
				productDescription: product.description ?? null,
				productImageUrl: product.imageUrl ?? null,
				productUrl: product.url ?? null,
				price: product.price,
			}),
		});
		if (res.ok) {
			const newIng = await res.json() as FavoriteIngredient;
			ingredients = [...ingredients, newIng];
			searchQuery = '';
			searchResults = [];
			searchStatus = 'idle';
		}
	}
</script>

<div class="group relative flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden transition-shadow hover:shadow-md">
	<!-- Image area -->
	<div class="relative bg-zinc-50 aspect-video overflow-hidden">
		{#if recipe.imageUrl}
			<img src={recipe.imageUrl} alt={recipe.name} class="w-full h-full object-cover" loading="lazy" />
		{:else}
			<div class="w-full h-full flex items-center justify-center text-zinc-300">
				<svg class="size-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<path d="M3 2h18v16H3z M7 22h10 M12 18v4"/>
					<path d="M8 7h8 M8 11h5"/>
				</svg>
			</div>
		{/if}

		{#if recipe.preparationTime}
			<div class="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
				<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<polyline points="12 6 12 12 16 14"/>
				</svg>
				{formatTime(recipe.preparationTime)}
			</div>
		{/if}
	</div>

	<!-- Card body -->
	<div class="flex flex-col gap-1 p-3 flex-1">
		<p class="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2">{recipe.name}</p>

		<!-- Expand toggle -->
		<div class="mt-1 flex items-center">
			<button
				type="button"
				onclick={() => { expanded = !expanded; }}
				class="ml-auto flex items-center gap-0.5 text-zinc-400 hover:text-zinc-900 transition-colors"
				title={expanded ? 'Hide ingredients' : 'Show ingredients'}
				aria-label={expanded ? 'Hide ingredients' : 'Show ingredients'}
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
					<path d="M7 2v20"/>
					<path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
				</svg>
				<svg class="size-3 transition-transform {expanded ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<polyline points="6 9 12 15 18 9"/>
				</svg>
			</button>
		</div>

		<!-- Ingredient list -->
		{#if expanded}
			<div class="mt-1 border-t border-zinc-100 pt-2 space-y-0 max-h-80 overflow-y-auto -mx-1">
				{#each ingredients as ing (ing.id)}
					<IngredientRow
						imageUrl={ing.productImageUrl}
						name={ing.productName}
						meta={ing.productDescription}
						quantity={ing.quantity}
						price={ing.price * ing.quantity}
						isDeselected={ing.isDeselected}
						isCustom={ing.isCustom}
						href={ing.productUrl}
						onToggleDeselect={() => toggleDeselect(ing)}
						onQuantityChange={(v) => onQuantityChange(ing, v)}
						onRemove={() => removeIngredient(ing)}
					/>
				{/each}

				{#if ingredients.length === 0}
					<p class="text-xs text-zinc-400 px-1 py-2">No ingredients. Add products below.</p>
				{/if}

				<!-- Total -->
				<div class="px-1 pt-2 mt-1 border-t border-zinc-100 flex items-center justify-between">
					<span class="text-xs text-zinc-500">Total</span>
					<span class="text-sm font-bold text-zinc-900">{formatPrice(activeTotal)}</span>
				</div>
			</div>

			<!-- Custom ingredient search -->
			<div class="mt-3 border-t border-zinc-100 pt-3">
				<div class="relative">
					<div class="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
						{#if searchStatus === 'loading'}
							<svg class="size-3.5 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
							</svg>
						{:else}
							<svg class="size-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="11" cy="11" r="8"/>
								<path d="m21 21-4.35-4.35"/>
							</svg>
						{/if}
					</div>
					<input
						type="search"
						bind:value={searchQuery}
						oninput={onSearchInput}
						placeholder="Add product…"
						autocomplete="off"
						class="block w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs
							text-zinc-900 placeholder:text-zinc-400
							focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
					/>
				</div>

				{#if searchStatus === 'done' && searchResults.length > 0}
					<div class="mt-1 rounded-lg border border-zinc-200 bg-white overflow-hidden max-h-48 overflow-y-auto">
						{#each searchResults as product (product.id)}
							<button
								type="button"
								onclick={() => addCustomIngredient(product)}
								class="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0"
							>
								{#if product.imageUrl}
									<img src={product.imageUrl} alt={product.name} class="w-7 h-7 shrink-0 rounded object-contain bg-zinc-50" loading="lazy" />
								{:else}
									<div class="w-7 h-7 shrink-0 rounded bg-zinc-100"></div>
								{/if}
								<div class="flex-1 min-w-0">
									<span class="block text-xs text-zinc-800 truncate">{product.name}</span>
									{#if product.description}
										<span class="block text-[10px] text-zinc-400 truncate leading-tight">{product.description}</span>
									{/if}
								</div>
								<span class="text-xs font-medium text-zinc-500 shrink-0">{formatPrice(product.price)}</span>
							</button>
						{/each}
					</div>
				{:else if searchStatus === 'done' && searchQuery.trim().length >= 2}
					<p class="text-xs text-zinc-400 mt-1 px-1">No products found.</p>
				{/if}
			</div>
		{/if}

		<!-- Action row -->
		<div class="mt-auto pt-3 flex items-center justify-between gap-2">
			{#if !expanded}
				<span class="text-sm font-bold text-zinc-900">{formatPrice(activeTotal)}</span>
			{:else}
				<div></div>
			{/if}

			<!-- Price history toggle -->
			<button
				type="button"
				onclick={() => { showPriceHistory = !showPriceHistory; }}
				title={showPriceHistory ? 'Hide price history' : 'Show price history'}
				aria-label={showPriceHistory ? 'Hide price history' : 'Show price history'}
				class="flex items-center justify-center w-7 h-7 rounded-full transition-colors
					{showPriceHistory ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'}"
			>
				<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
				</svg>
			</button>

			<!-- Add to basket -->
			{#if addStatus === 'done'}
				<div class="flex items-center gap-1.5 rounded-full bg-green-600 text-white px-3 py-1.5 text-xs font-medium">
					<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
					Added!
				</div>
			{:else if addStatus === 'error'}
				<div class="flex items-center gap-1.5 rounded-full bg-red-500 text-white px-3 py-1.5 text-xs font-medium">
					Failed
				</div>
			{:else if basketAvailable}
				<button
					type="button"
					onclick={handleAddToBasket}
					disabled={addStatus === 'adding' || ingredients.filter((i) => !i.isDeselected).length === 0}
					title="Add to basket"
					class="flex items-center gap-1.5 rounded-full bg-zinc-800 text-white px-3 py-1.5
						text-xs font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{#if addStatus === 'adding'}
						<svg class="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
						</svg>
					{:else}
						<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="9" cy="21" r="1"/>
							<circle cx="20" cy="21" r="1"/>
							<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
						</svg>
					{/if}
					Add
				</button>
			{:else}
				<button type="button" disabled class="flex items-center gap-1.5 rounded-full bg-zinc-100 text-zinc-400 px-3 py-1.5 text-xs font-medium cursor-not-allowed">
					<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="9" cy="21" r="1"/>
						<circle cx="20" cy="21" r="1"/>
						<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
					</svg>
					Add
				</button>
			{/if}
		</div>

		{#if showPriceHistory}
			<PriceHistoryChart recipeId={recipe.recipeId} />
		{/if}
	</div>

	<!-- Favorite (heart) button — overlaid top-left -->
	<button
		type="button"
		onclick={() => onToggleFavorite(recipe)}
		title="Remove from favorites"
		aria-label="Remove from favorites"
		class="absolute top-2 left-2 flex items-center justify-center w-8 h-8 rounded-full
			bg-white/90 shadow transition-colors hover:bg-white text-red-500"
	>
		<svg class="size-4" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
			<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
		</svg>
	</button>
</div>
