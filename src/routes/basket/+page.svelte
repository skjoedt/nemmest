<script lang="ts">
	import { onMount } from 'svelte';
	import type { BasketLine, BasketRecipe } from '$lib/types';
	import IngredientRow from '$lib/components/IngredientRow.svelte';

	// ── State ────────────────────────────────────────────────────────────────

	type Status = 'checking' | 'unauthenticated' | 'loading' | 'error' | 'done';
	let status = $state<Status>('checking');
	let lines = $state<BasketLine[]>([]);
	let recipes = $state<BasketRecipe[]>([]);
	let totalProductsPrice = $state(0);
	let error = $state('');

	// Track which recipe rows are expanded (showing line items)
	let expandedRecipes = $state(new Set<string>());

	// ── Lifecycle ────────────────────────────────────────────────────────────

	onMount(async () => {
		try {
			const res = await fetch('/api/nemlig/session');
			if (!res.ok) { status = 'unauthenticated'; return; }
		} catch {
			status = 'unauthenticated'; return;
		}

		await loadBasket();
	});

	async function loadBasket() {
		status = 'loading';
		try {
			const res = await fetch('/api/nemlig/basket/GetBasket');
			const data = await res.json() as {
				Lines?: BasketLine[];
				Recipes?: BasketRecipe[];
				TotalProductsPrice?: number;
				reason?: string;
				error?: string;
			};
			if (!res.ok) {
				if (data.reason === 'session_expired' || data.reason === 'unauthenticated') {
					status = 'unauthenticated';
				} else {
					error = data.error ?? `Error ${res.status}`;
					status = 'error';
				}
				return;
			}
			lines = data.Lines ?? [];
			recipes = data.Recipes ?? [];
			totalProductsPrice = data.TotalProductsPrice ?? 0;
			status = 'done';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not load basket.';
			status = 'error';
		}
	}

	// ── Basket mutations ─────────────────────────────────────────────────────

	// Track in-flight line IDs to disable controls while a request is pending
	let pending = $state(new Set<string>());

	async function setQuantity(line: BasketLine, newQty: number) {
		if (pending.has(line.Id)) return;
		pending = new Set([...pending, line.Id]);

		// Optimistic update
		if (newQty <= 0) {
			lines = lines.filter((l) => l.Id !== line.Id);
		} else {
			lines = lines.map((l) => l.Id === line.Id ? { ...l, Quantity: newQty } : l);
		}

		try {
			const res = await fetch('/api/nemlig/basket/AddToBasket', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					ProductId: line.Id,
					quantity: newQty,
					AffectPartialQuantity: true,
					disableQuantityValidation: false,
				}),
			});
			if (res.ok) {
				const data = await res.json() as { TotalProductsPrice?: number; Lines?: BasketLine[] };
				if (data.TotalProductsPrice !== undefined) totalProductsPrice = data.TotalProductsPrice;
				if (data.Lines !== undefined) lines = data.Lines;
			}
		} finally {
			pending = new Set([...pending].filter((id) => id !== line.Id));
		}
	}

	// Track in-flight recipe IDs
	let pendingRecipes = $state(new Set<string>());

	async function removeRecipe(recipeId: string) {
		if (pendingRecipes.has(recipeId)) return;
		pendingRecipes = new Set([...pendingRecipes, recipeId]);

		// Optimistic removal — save snapshot for rollback
		const snapshot = recipes;
		recipes = recipes.filter((r) => r.Id !== recipeId);

		try {
			const res = await fetch(
				`/api/nemlig/basket/RemoveRecipeFromBasket?recipeId=${encodeURIComponent(recipeId)}`,
				{ method: 'POST' },
			);
			if (res.ok) {
				const data = await res.json() as { TotalProductsPrice?: number; Lines?: BasketLine[]; Recipes?: BasketRecipe[] };
				if (data.TotalProductsPrice !== undefined) totalProductsPrice = data.TotalProductsPrice;
				if (data.Lines !== undefined) lines = data.Lines;
				if (data.Recipes !== undefined) recipes = data.Recipes;
			} else {
				// Request failed — restore the snapshot so the recipe reappears
				recipes = snapshot;
			}
		} catch {
			// Network error — restore the snapshot
			recipes = snapshot;
		} finally {
			pendingRecipes = new Set([...pendingRecipes].filter((id) => id !== recipeId));
		}
	}

	function toggleRecipeExpanded(recipeId: string) {
		const next = new Set(expandedRecipes);
		if (next.has(recipeId)) {
			next.delete(recipeId);
		} else {
			next.add(recipeId);
		}
		expandedRecipes = next;
	}

	// ── Formatting ───────────────────────────────────────────────────────────

	function fmt(n: number): string {
		const [int, dec] = n.toFixed(2).split('.');
		return dec === '00' ? `${int},-` : `${int},${dec}`;
	}

	const SORT_LABELS: Record<string, string> = {
		default: 'Default',
		recommended: 'Recommended',
		priceasc: 'Cheapest',
		organic: 'Organic',
	};

	const isEmpty = $derived(status === 'done' && lines.length === 0 && recipes.length === 0);
</script>

<div class="py-6 space-y-6">

	<!-- Page header -->
	<div>
		<h1 class="text-xl font-semibold text-zinc-900">Basket</h1>
		<p class="mt-1 text-sm text-zinc-500">Your current nemlig.com shopping basket.</p>
	</div>

	<!-- Not connected banner -->
	{#if status === 'unauthenticated'}
		<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			Not connected to nemlig.com. Go to <a href="/settings" class="font-medium underline underline-offset-2">Settings</a> to log in.
		</div>

	<!-- Checking / loading -->
	{:else if status === 'checking' || status === 'loading'}
		<div class="flex items-center gap-2 text-sm text-zinc-400">
			<svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
			</svg>
			Loading basket…
		</div>

	<!-- Error -->
	{:else if status === 'error'}
		<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{error}
		</div>

	<!-- Empty basket -->
	{:else if isEmpty}
		<div class="rounded-xl border border-dashed border-zinc-200 px-6 py-10 text-center">
			<svg class="mx-auto size-8 text-zinc-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
				<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
			</svg>
			<p class="text-sm text-zinc-400">Your basket is empty.</p>
		</div>

	<!-- Basket content -->
	{:else}
		<div class="rounded-xl border border-zinc-200 bg-white overflow-hidden">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-zinc-100 text-left text-xs font-medium text-zinc-400">
						<th class="px-4 py-3 w-14"></th>
						<th class="px-4 py-3">Product</th>
						<th class="px-4 py-3 text-right whitespace-nowrap">Unit price</th>
						<th class="px-4 py-3 text-right">Qty</th>
						<th class="px-4 py-3 text-right">Total</th>
						<th class="px-4 py-3 w-10"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-100">

					<!-- ── Regular product lines ──────────────────────────────────── -->
					{#each lines as line (line.Id)}
						{@const busy = pending.has(line.Id)}
						<tr class="hover:bg-zinc-50 transition-colors" class:opacity-50={busy}>
							<!-- Image -->
							<td class="px-4 py-3">
								{#if line.PrimaryImage}
									<img src={line.PrimaryImage} alt={line.Name} class="w-10 h-10 object-contain" loading="lazy" />
								{:else}
									<div class="w-10 h-10 rounded bg-zinc-100"></div>
								{/if}
							</td>
							<!-- Name + description -->
							<td class="px-4 py-3">
								<p class="font-medium text-zinc-900 leading-snug">{line.Name}</p>
								{#if line.Description}
									<p class="text-xs text-zinc-400 leading-snug">{line.Description}</p>
								{/if}
							</td>
							<!-- Unit price -->
							<td class="px-4 py-3 text-right text-zinc-600 whitespace-nowrap">{line.UnitPrice} {line.UnitPriceLabel}</td>
							<!-- Stepper -->
							<td class="px-4 py-3">
								<div class="flex items-center justify-end">
									<div class="flex items-center rounded-full border border-zinc-200 bg-white overflow-hidden h-8">
										<button
											type="button"
											onclick={() => setQuantity(line, line.Quantity - 1)}
											disabled={busy}
											aria-label="Remove one"
											class="flex items-center justify-center w-8 h-full text-zinc-600 hover:bg-zinc-100 transition-colors disabled:cursor-not-allowed"
										>−</button>
										<span class="min-w-[1.5rem] text-center text-sm font-semibold text-zinc-900 px-0.5 select-none">{line.Quantity}</span>
										<button
											type="button"
											onclick={() => setQuantity(line, line.Quantity + 1)}
											disabled={busy}
											aria-label="Add one"
											class="flex items-center justify-center w-8 h-full text-zinc-600 hover:bg-zinc-100 transition-colors disabled:cursor-not-allowed"
										>+</button>
									</div>
								</div>
							</td>
							<!-- Line total -->
							<td class="px-4 py-3 text-right font-semibold text-zinc-900 whitespace-nowrap">{fmt(line.ItemPrice * line.Quantity)} kr.</td>
							<!-- Delete -->
							<td class="px-4 py-3">
								<button
									type="button"
									onclick={() => setQuantity(line, 0)}
									disabled={busy}
									aria-label="Remove {line.Name} from basket"
									title="Remove from basket"
									class="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400
										hover:text-red-500 hover:bg-red-50 transition-colors disabled:cursor-not-allowed"
								>
									<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="3 6 5 6 21 6"/>
										<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
										<path d="M10 11v6M14 11v6"/>
										<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
									</svg>
								</button>
							</td>
						</tr>
					{/each}

					<!-- ── Recipes section ─────────────────────────────────────────── -->
					{#if recipes.length > 0}
						<!-- Section header row -->
						<tr class="bg-zinc-50 border-t border-zinc-200">
							<td colspan="6" class="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
								Recipes
							</td>
						</tr>

						{#each recipes as recipe (recipe.Id)}
							{@const busy = pendingRecipes.has(recipe.Id)}
							{@const expanded = expandedRecipes.has(recipe.Id)}
							{@const sortLabel = SORT_LABELS[recipe.Sorting] ?? recipe.Sorting}

							<!-- Recipe row -->
							<tr class="hover:bg-zinc-50 transition-colors border-t border-zinc-100" class:opacity-50={busy}>
								<!-- Thumbnail -->
								<td class="px-4 py-3">
									{#if recipe.PrimaryImage}
										<img src={recipe.PrimaryImage} alt={recipe.Title} class="w-10 h-10 object-cover rounded" loading="lazy" />
									{:else}
										<div class="w-10 h-10 rounded bg-zinc-100 flex items-center justify-center text-zinc-300">
											<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
												<path d="M3 2h18v16H3z M7 22h10 M12 18v4"/>
											</svg>
										</div>
									{/if}
								</td>

								<!-- Title + meta + expand toggle -->
								<td class="px-4 py-3">
									<p class="font-medium text-zinc-900 leading-snug">{recipe.Title}</p>
									<p class="text-xs text-zinc-400 leading-snug mt-0.5">
										{recipe.Persons} {recipe.Persons === 1 ? 'person' : 'people'} · {sortLabel}
									</p>
									<button
										type="button"
										onclick={() => toggleRecipeExpanded(recipe.Id)}
										class="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
									>
										{expanded ? 'Hide contents' : 'Show contents'}
										<svg
											class="size-3 transition-transform {expanded ? 'rotate-180' : ''}"
											viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
										>
											<polyline points="6 9 12 15 18 9"/>
										</svg>
									</button>
								</td>

								<!-- Unit price cell — empty for recipes -->
								<td class="px-4 py-3"></td>

								<!-- Qty — always 1, no stepper -->
								<td class="px-4 py-3 text-right">
									<span class="text-sm font-semibold text-zinc-900">1</span>
								</td>

								<!-- Total -->
								<td class="px-4 py-3 text-right font-semibold text-zinc-900 whitespace-nowrap">
									{fmt(recipe.RecipeTotalPrice)} kr.
								</td>

								<!-- Delete -->
								<td class="px-4 py-3">
									<button
										type="button"
										onclick={() => removeRecipe(recipe.Id)}
										disabled={busy}
										aria-label="Remove {recipe.Title} from basket"
										title="Remove recipe from basket"
										class="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400
											hover:text-red-500 hover:bg-red-50 transition-colors disabled:cursor-not-allowed"
									>
										<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<polyline points="3 6 5 6 21 6"/>
											<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
											<path d="M10 11v6M14 11v6"/>
											<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
										</svg>
									</button>
								</td>
							</tr>

							<!-- Expanded recipe line items -->
							{#if expanded}
								<tr class="border-t border-zinc-100">
									<td colspan="6" class="pl-14 pr-4 py-2">
										<div class="space-y-0">
											{#each recipe.RecipeLineItems as item (item.Id)}
												<IngredientRow
													imageUrl={item.PrimaryImage}
													name={item.Name}
													meta={item.Description}
													quantity={item.Quantity}
													price={item.ItemPrice}
													href={item.Url}
												/>
											{/each}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					{/if}

				</tbody>
				<tfoot>
					<tr class="border-t border-zinc-200 bg-zinc-50">
						<td colspan="4" class="px-4 py-3 text-sm font-medium text-zinc-500">Total</td>
						<td class="px-4 py-3 text-right text-base font-bold text-zinc-900 whitespace-nowrap">{fmt(totalProductsPrice)} kr.</td>
						<td></td>
					</tr>
				</tfoot>
			</table>
		</div>
	{/if}

</div>
