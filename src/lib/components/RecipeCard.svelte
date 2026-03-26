<script lang="ts">
	import { onMount } from 'svelte';
	import { Circle, Star, PiggyBank, Leaf } from 'lucide-svelte';
	import type { NemligRecipe, FavoriteRecipe, RecipeIngredient, RecipeSortOrder } from '$lib/types';
	import IngredientRow from './IngredientRow.svelte';

	interface Props {
		recipe: NemligRecipe | FavoriteRecipe;
		isFavorite: boolean;
		persons: number;
		/** Starting sort order for search results (no saved preference).
		 * Ignored when the recipe already has a saved sortOrder (favorites). */
		initialSortOrder?: RecipeSortOrder;
		/** Whether to render optional (supplement) ingredients in the list */
		showOptionalIngredients?: boolean;
		onToggleFavorite: (recipe: NemligRecipe | FavoriteRecipe) => void;
		/** Called whenever the user toggles an ingredient — passes the new full deselected set */
		onDeselectionChange?: (recipeId: string, deselectedIds: string[]) => void;
		/** IDs of deselected ingredients (productSelectionId). Deselected = greyed out, excluded from total/basket. */
		deselectedIngredientIds?: string[];
		/** Called when the sort order changes */
		onSortOrderChange?: (recipeId: string, sortOrder: RecipeSortOrder) => void;
		/** Whether nemlig basket is available (authenticated) */
		basketAvailable?: boolean;
		/**
		 * Called when the user confirms adding this recipe to the nemlig basket.
		 * The card passes all necessary parameters (already resolved from its own state).
		 */
		onAddToBasket?: (
			recipe: NemligRecipe | FavoriteRecipe,
			sortOrder: RecipeSortOrder,
			selectedProducts: { ProductSelectionId: string; ProductSelectionName: string; ProductId: string; Quantity: number }[],
			persons: number,
		) => Promise<void>;
	}

	let {
		recipe,
		isFavorite,
		persons,
		deselectedIngredientIds = [],
		initialSortOrder = 'default',
		showOptionalIngredients = true,
		onToggleFavorite,
		onDeselectionChange,
		onSortOrderChange,
		basketAvailable = false,
		onAddToBasket,
	}: Props = $props();

	// Normalise: NemligRecipe uses 'id', FavoriteRecipe uses 'recipeId'
	const recipeId = $derived('recipeId' in recipe ? recipe.recipeId : recipe.id);
	const name = $derived(recipe.name);
	const description = $derived(recipe.description ?? null);
	const imageUrl = $derived(recipe.imageUrl ?? null);
	const preparationTime = $derived(recipe.preparationTime ?? null);

	// Ingredient state
	type IngredientStatus = 'idle' | 'loading' | 'error' | 'done';
	let ingredientStatus = $state<IngredientStatus>('idle');
	let ingredients = $state<RecipeIngredient[]>([]);
	// In-flight fetch promise — any concurrent caller awaits the same request
	// rather than returning early with stale data (prevents the confirmAdd race).
	let ingredientsFlight: Promise<void> | null = null;
	// Tracks the persons count that the current ingredients[] were fetched for.
	let loadedPersons = $state(0);
	// Saved favorite preference wins over initialSortOrder; initialSortOrder wins over 'default'
	let sortOrder = $state<RecipeSortOrder>(
		('sortOrder' in recipe && recipe.sortOrder) ? recipe.sortOrder : initialSortOrder
	);
	let expanded = $state(false);

	// Deselection — local set of productSelectionIds. Initialised from prop.
	let deselected = $state(new Set<string>(deselectedIngredientIds));

	// Recompute totals reactively based on deselection
	const ingredientTotal = $derived(
		ingredients
			.filter((i) => !deselected.has(i.productSelectionId))
			.reduce((sum, i) => sum + i.price, 0)
	);

	// The active (selected) ingredients for basket use
	const activeIngredients = $derived(
		ingredients.filter((i) => !deselected.has(i.productSelectionId))
	);

	// Rendered list:
	// - Always drop optional (supplement) ingredients that have no product associated.
	// - If showOptionalIngredients is off, drop all supplement products too.
	const visibleIngredients = $derived(
		ingredients.filter((i) => {
			if (i.isSupplementProduct && !i.productId) return false;
			if (i.isSupplementProduct && !showOptionalIngredients) return false;
			return true;
		})
	);

	type SortOption = { value: RecipeSortOrder; label: string; icon: typeof Circle };
	const sortOptions: SortOption[] = [
		{ value: 'default',     label: 'Default',     icon: Circle   },
		{ value: 'recommended', label: 'Recommended', icon: Star     },
		{ value: 'priceasc',    label: 'Cheapest',    icon: PiggyBank },
		{ value: 'organic',     label: 'Organic',     icon: Leaf     },
	];

	// ── Add-to-basket confirmation state ───────────────────────────────────────

	/** Whether the inline persons stepper is showing */
	let confirming = $state(false);
	/** Persons count for the confirmation step — defaults to the page-level persons prop */
	let confirmPersons = $state(persons);
	type AddStatus = 'idle' | 'adding' | 'done' | 'error';
	let addStatus = $state<AddStatus>('idle');

	function openConfirm() {
		confirmPersons = persons;
		confirming = true;
	}

	function cancelConfirm() {
		confirming = false;
		addStatus = 'idle';
	}

	function adjustPersons(delta: number) {
		confirmPersons = Math.min(10, Math.max(1, confirmPersons + delta));
	}

	async function confirmAdd() {
		if (!onAddToBasket || addStatus === 'adding') return;

		// Always fetch fresh ingredients for the confirmed persons count so
		// SelectedProducts reflects the exact products/quantities Nemlig expects.
		// Cancel any in-flight fetch first so we get a clean response for
		// confirmPersons (which may differ from the page-level persons count).
		ingredientsFlight = null;
		await loadIngredients(confirmPersons);

		const selectedProducts = activeIngredients.map((i) => ({
			ProductSelectionId: i.productSelectionId,
			ProductSelectionName: i.title,
			ProductId: i.productId,
			Quantity: i.amount,
		}));

		if (selectedProducts.length === 0) {
			addStatus = 'error';
			setTimeout(() => { addStatus = 'idle'; confirming = false; }, 3000);
			return;
		}

		addStatus = 'adding';
		try {
			await onAddToBasket(recipe, sortOrder, selectedProducts, confirmPersons);
			addStatus = 'done';
			confirming = false;
			setTimeout(() => { addStatus = 'idle'; }, 2000);
		} catch {
			addStatus = 'error';
			setTimeout(() => { addStatus = 'idle'; confirming = false; }, 3000);
		}
	}

	// Load ingredients eagerly so the price is visible immediately.
	// Re-fetch whenever the persons prop changes (e.g. user updates it in Settings).
	onMount(() => {
		loadIngredients(persons);
	});

	let prevPersons = persons;
	$effect(() => {
		// Re-fetch only when persons actually changes after the initial mount load.
		if (persons !== prevPersons) {
			prevPersons = persons;
			ingredientsFlight = null; // cancel any stale in-flight request
			loadIngredients(persons);
		}
	});

	function loadIngredients(personsCount: number): Promise<void> {
		// If a fetch is already in flight, return the same promise so concurrent
		// callers (e.g. confirmAdd) wait for the real result instead of getting
		// stale data.
		if (ingredientsFlight) return ingredientsFlight;

		ingredientStatus = 'loading';
		ingredientsFlight = (async () => {
			try {
				const res = await fetch(
					`/api/recipes/ingredients?recipeId=${encodeURIComponent(recipeId)}&sortorder=${sortOrder}&persons=${personsCount}`
				);
				if (!res.ok) {
					ingredientStatus = 'error';
					return;
				}
				const data = await res.json() as { ingredients: RecipeIngredient[]; total: number };
				ingredients = data.ingredients;
				// Auto-deselect optional ingredients that haven't been explicitly
				// tracked yet. This ensures they start deselected on first load and
				// after a sort-order change (which clears deselected before re-fetching),
				// while still respecting any saved deselection state for favorites.
				const next = new Set(deselected);
				for (const ing of data.ingredients) {
					if (ing.isSupplementProduct && !next.has(ing.productSelectionId)) {
						next.add(ing.productSelectionId);
					}
				}
				deselected = next;
				loadedPersons = personsCount;
				ingredientStatus = 'done';
			} catch {
				ingredientStatus = 'error';
			} finally {
				ingredientsFlight = null;
			}
		})();
		return ingredientsFlight;
	}

	function toggleExpanded() {
		expanded = !expanded;
	}

	async function onSortChange(newSort: RecipeSortOrder) {
		sortOrder = newSort;
		// A new sort order returns a different set of products (different productSelectionIds),
		// so any existing deselections are now stale — clear them and notify the parent.
		deselected = new Set();
		onDeselectionChange?.(recipeId, []);
		onSortOrderChange?.(recipeId, newSort);
		await loadIngredients(persons);
	}

	function toggleIngredient(ing: RecipeIngredient) {
		const next = new Set(deselected);
		if (next.has(ing.productSelectionId)) {
			next.delete(ing.productSelectionId);
		} else {
			next.add(ing.productSelectionId);
		}
		deselected = next;
		onDeselectionChange?.(recipeId, [...next]);
	}

	function formatPrice(p: number): string {
		const [int, dec] = p.toFixed(2).split('.');
		return dec === '00' ? `${int},-` : `${int},${dec}`;
	}

	function formatTime(minutes: number): string {
		if (minutes < 60) return `${minutes} min`;
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
	}
</script>

<div class="group relative flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden transition-shadow hover:shadow-md">
	<!-- Image area -->
	<div class="relative bg-zinc-50 aspect-video overflow-hidden">
		{#if imageUrl}
			<img
				src={imageUrl}
				alt={name}
				class="w-full h-full object-cover"
				loading="lazy"
			/>
		{:else}
			<div class="w-full h-full flex items-center justify-center text-zinc-300">
				<svg class="size-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<path d="M3 2h18v16H3z M7 22h10 M12 18v4"/>
					<path d="M8 7h8 M8 11h5"/>
				</svg>
			</div>
		{/if}

		<!-- Preparation time badge -->
		{#if preparationTime}
			<div class="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
				<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<polyline points="12 6 12 12 16 14"/>
				</svg>
				{formatTime(preparationTime)}
			</div>
		{/if}
	</div>

	<!-- Card body -->
	<div class="flex flex-col gap-1 p-3 flex-1">
		<p class="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2">{name}</p>

		{#if description}
			<p class="text-xs text-zinc-500 leading-snug line-clamp-2">{description}</p>
		{/if}

		<!-- Sort selector (icon buttons) + ingredients toggle -->
		<div class="mt-2 flex items-center gap-2">
			<!-- Icon sort control -->
			<div class="flex rounded-lg border border-zinc-200 overflow-hidden">
				{#each sortOptions as opt (opt.value)}
					<button
						type="button"
						onclick={() => onSortChange(opt.value)}
						title={opt.label}
						aria-label={opt.label}
						class="p-1.5 transition-colors
							{sortOrder === opt.value
								? 'bg-zinc-900 text-white'
								: 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700'}"
					>
						<opt.icon size={14} strokeWidth={2} />
					</button>
				{/each}
			</div>

			<!-- Expand ingredients icon button -->
			<button
				type="button"
				onclick={toggleExpanded}
				title={expanded ? 'Hide ingredients' : 'Show ingredients'}
				aria-label={expanded ? 'Hide ingredients' : 'Show ingredients'}
				class="ml-auto flex items-center gap-0.5 text-zinc-400 hover:text-zinc-900 transition-colors"
			>
				<!-- Utensils (fork + knife) icon -->
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
					<path d="M7 2v20"/>
					<path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
				</svg>
				<svg
					class="size-3 transition-transform {expanded ? 'rotate-180' : ''}"
					viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
				>
					<polyline points="6 9 12 15 18 9"/>
				</svg>
			</button>
		</div>

		<!-- Ingredient list (collapsible) -->
		{#if expanded}
			<div class="mt-2 border-t border-zinc-100 pt-2">
				{#if ingredientStatus === 'loading'}
					<div class="space-y-1 py-1">
						{#each Array(4) as _}
							<div class="h-7 rounded bg-zinc-100 animate-pulse w-full"></div>
						{/each}
					</div>
				{:else if ingredientStatus === 'error'}
					<p class="text-xs text-red-500 py-1">Could not load ingredients.</p>
				{:else if ingredientStatus === 'done'}
					<div class="space-y-0 max-h-64 overflow-y-auto -mx-1">
						{#each visibleIngredients as ing (ing.productSelectionId)}
						<IngredientRow
							imageUrl={ing.productImageUrl}
							name={ing.productName}
							meta={ing.unitPrice}
							quantity={ing.amount}
							price={ing.price}
							isDeselected={deselected.has(ing.productSelectionId)}
							onclick={() => toggleIngredient(ing)}
						/>
						{/each}
					</div>
					<div class="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2">
						<span class="text-xs text-zinc-500">Total ({loadedPersons} {loadedPersons === 1 ? 'person' : 'people'})</span>
						<span class="text-sm font-bold text-zinc-900">{formatPrice(ingredientTotal)}</span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Action row -->
		<div class="mt-auto pt-3 flex items-center justify-between gap-2">
			<!-- Price summary (when not expanded) -->
			{#if !expanded && ingredientStatus === 'done'}
				<span class="text-sm font-bold text-zinc-900">{formatPrice(ingredientTotal)}</span>
			{:else}
				<div></div>
			{/if}

			<!-- Add to basket button / inline confirmation stepper -->
			{#if addStatus === 'done'}
				<!-- Success state — auto-resets -->
				<div class="flex items-center gap-1.5 rounded-full bg-green-600 text-white px-3 py-1.5 text-xs font-medium">
					<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
					Added!
				</div>
			{:else if addStatus === 'error'}
				<!-- Error state — auto-resets -->
				<div class="flex items-center gap-1.5 rounded-full bg-red-500 text-white px-3 py-1.5 text-xs font-medium">
					<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 9v4M12 17h.01"/>
						<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
					</svg>
					Failed
				</div>
			{:else if confirming}
				<!-- Inline persons stepper + confirm -->
				<div class="flex items-center gap-1 ml-auto">
					<!-- Cancel -->
					<button
						type="button"
						onclick={cancelConfirm}
						title="Cancel"
						class="flex items-center justify-center w-7 h-7 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
					>
						<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<path d="M18 6L6 18M6 6l12 12"/>
						</svg>
					</button>

					<!-- Persons stepper -->
					<div class="flex items-center rounded-full border border-zinc-200 bg-white overflow-hidden h-7">
						<button
							type="button"
							onclick={() => adjustPersons(-1)}
							disabled={confirmPersons <= 1}
							class="px-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors h-full"
						>−</button>
						<span class="px-1.5 text-xs font-semibold text-zinc-900 tabular-nums min-w-[2.5rem] text-center">
							{confirmPersons} {confirmPersons === 1 ? 'person' : 'people'}
						</span>
						<button
							type="button"
							onclick={() => adjustPersons(1)}
							disabled={confirmPersons >= 10}
							class="px-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors h-full"
						>+</button>
					</div>

					<!-- Confirm add -->
					<button
						type="button"
						onclick={confirmAdd}
						disabled={addStatus === 'adding'}
						title="Add to basket"
						class="flex items-center gap-1 rounded-full bg-zinc-900 text-white px-3 py-1.5
							text-xs font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{#if addStatus === 'adding'}
							<svg class="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
							</svg>
						{:else}
							<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
								<polyline points="9 18 15 12 9 6"/>
							</svg>
						{/if}
					</button>
				</div>
			{:else if basketAvailable && onAddToBasket}
				<!-- Default: Add button -->
				<button
					type="button"
					onclick={openConfirm}
					title="Add to basket"
					class="flex items-center gap-1.5 rounded-full bg-zinc-800 text-white px-3 py-1.5
						text-xs font-medium hover:bg-zinc-700 transition-colors"
				>
					<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="9" cy="21" r="1"/>
						<circle cx="20" cy="21" r="1"/>
						<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
					</svg>
					Add
				</button>
			{:else}
				<!-- Not authenticated -->
				<button
					type="button"
					disabled
					title="Log in to add to basket"
					class="flex items-center gap-1.5 rounded-full bg-zinc-100 text-zinc-400 px-3 py-1.5
						text-xs font-medium cursor-not-allowed"
				>
					<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="9" cy="21" r="1"/>
						<circle cx="20" cy="21" r="1"/>
						<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
					</svg>
					Add
				</button>
			{/if}
		</div>
	</div>

	<!-- Favorite button — overlaid top-left of image -->
	<button
		type="button"
		onclick={() => onToggleFavorite(recipe)}
		title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
		aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
		class="absolute top-2 left-2 flex items-center justify-center w-8 h-8 rounded-full
			bg-white/90 shadow transition-colors hover:bg-white
			{isFavorite ? 'text-red-500' : 'text-zinc-400 hover:text-red-400'}"
	>
		<svg class="size-4" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
			<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
		</svg>
	</button>
</div>
