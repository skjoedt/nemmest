<script lang="ts">
	import type { NemligProduct, FavoriteProduct } from '$lib/types';
	import { formatPrice } from '$lib/format';

	interface Props {
		product: NemligProduct | FavoriteProduct;
		isFavorite: boolean;
		/** When true, show price info (search results). Favorites don't show price. */
		showPrice?: boolean;
		/** Current quantity in the nemlig basket. Undefined = basket not loaded / not authenticated. */
		basketQty?: number;
		onToggleFavorite: (product: NemligProduct | FavoriteProduct) => void;
		/** Called when user wants to set a new basket quantity. Absence means basket not available. */
		onBasketChange?: (productId: number, newQty: number) => void;
	}

	let { product, isFavorite, showPrice = true, basketQty, onToggleFavorite, onBasketChange }: Props = $props();

	// Normalise the union into a flat view. Discriminate by 'price' which only NemligProduct has.
	const p = $derived.by(() => {
		if ('price' in product) {
			return {
				productId: parseInt(product.id, 10),
				name: product.name,
				description: product.description,
				imageUrl: product.imageUrl,
				brand: product.brand,
				price: product.price,
				campaignPrice: product.campaignPrice,
				discountSavings: product.discountSavings,
				unitPrice: product.unitPrice,
				isOnSale: product.isOnSale,
			};
		}
		return {
			productId: product.productId,
			name: product.name,
			description: product.description,
			imageUrl: product.imageUrl,
			brand: product.brand,
			price: null as number | null,
			campaignPrice: null as number | null,
			discountSavings: null as number | null,
			unitPrice: null as string | null,
			isOnSale: false,
		};
	});

	const inBasket = $derived(basketQty !== undefined && basketQty > 0);
</script>

<div class="group relative flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden transition-shadow hover:shadow-md">
	<!-- Image area -->
	<div class="relative bg-zinc-50 aspect-square overflow-hidden">
		{#if p.imageUrl}
			<img
				src={p.imageUrl}
				alt={p.name}
				class="w-full h-full object-contain p-3"
				loading="lazy"
			/>
		{:else}
			<div class="w-full h-full flex items-center justify-center text-zinc-300">
				<svg class="size-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<rect x="3" y="3" width="18" height="18" rx="2"/>
					<path d="M3 9l4-4 4 4 4-4 4 4"/>
					<path d="M3 15l4-4 4 4 4-4 4 4"/>
				</svg>
			</div>
		{/if}

		<!-- Campaign badge -->
		{#if showPrice && p.isOnSale && p.discountSavings}
			<div class="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-12 h-12 flex flex-col items-center justify-center leading-tight shadow">
				<span class="text-[9px] font-semibold">Køb flere,</span>
				<span class="text-[9px] font-semibold">spar mere</span>
			</div>
		{/if}
	</div>

	<!-- Card body -->
	<div class="flex flex-col gap-1 p-3 flex-1">
		<p class="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2">{p.name}</p>

		{#if p.description || p.brand}
			<p class="text-xs text-zinc-500 leading-snug line-clamp-2">
				{#if p.description}{p.description}{/if}
			</p>
		{/if}
		<div class="mt-auto pt-2 flex items-end justify-between gap-2">
			<!-- Price block — only for search results -->
			{#if showPrice && p.price !== null}
				<div>
					{#if p.isOnSale && p.campaignPrice !== null}
						<div class="flex items-baseline gap-1.5">
							<span class="text-xl font-black text-orange-500">{formatPrice(p.campaignPrice)}</span>
							<span class="text-sm text-zinc-400 line-through">{formatPrice(p.price)}</span>
						</div>
					{:else}
						<span class="text-xl font-black text-zinc-900">{formatPrice(p.price)}</span>
					{/if}
					{#if p.unitPrice}
						<p class="text-[10px] text-zinc-400">{p.unitPrice}</p>
					{/if}
				</div>
			{/if}

			<!-- Basket control -->
			{#if inBasket}
				<div class="flex-shrink-0 flex items-center rounded-full border border-zinc-200 bg-white overflow-hidden h-9">
					<button
						type="button"
						onclick={() => onBasketChange!(p.productId, basketQty! - 1)}
						aria-label="Remove one from basket"
						class="flex items-center justify-center w-9 h-full text-zinc-600 hover:bg-zinc-100 transition-colors text-lg font-medium"
					>−</button>
					<span class="min-w-[1.5rem] text-center text-sm font-semibold text-zinc-900 px-0.5 select-none">{basketQty}</span>
					<button
						type="button"
						onclick={() => onBasketChange!(p.productId, basketQty! + 1)}
						aria-label="Add one to basket"
						class="flex items-center justify-center w-9 h-full text-zinc-600 hover:bg-zinc-100 transition-colors text-lg font-medium"
					>+</button>
				</div>
			{:else if onBasketChange}
				<button
					type="button"
					onclick={() => onBasketChange(p.productId, 1)}
					title="Add to basket"
					aria-label="Add to basket"
					class="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full
						bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
				>
					<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="9" cy="21" r="1"/>
						<circle cx="20" cy="21" r="1"/>
						<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
					</svg>
				</button>
			{:else}
				<button
					type="button"
					title="Add to basket"
					disabled
					class="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full
						bg-zinc-100 text-zinc-400 cursor-not-allowed"
					aria-label="Add to basket"
				>
					<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="9" cy="21" r="1"/>
						<circle cx="20" cy="21" r="1"/>
						<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<!-- Favorite button — overlaid top-left of image -->
	<button
		type="button"
		onclick={() => onToggleFavorite(product)}
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
