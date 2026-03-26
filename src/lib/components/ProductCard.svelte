<script lang="ts">
	import type { NemligProduct, FavoriteProduct } from '$lib/types';

	interface Props {
		product: NemligProduct | FavoriteProduct;
		isFavorite: boolean;
		/** When true, show price info (search results). Favorites don't show price. */
		showPrice?: boolean;
		onToggleFavorite: (product: NemligProduct | FavoriteProduct) => void;
	}

	let { product, isFavorite, showPrice = true, onToggleFavorite }: Props = $props();

	// Normalise: both NemligProduct (id: string) and FavoriteProduct (productId: number)
	// expose the fields we need. Use $derived so these update if the prop changes.
	// Discriminate by 'price' — NemligProduct has it, FavoriteProduct does not.
	// Can't use 'id' because the DB row also includes an 'id' serial PK column.
	const productId = $derived('price' in product
		? parseInt(product.id, 10)
		: product.productId);

	const name = $derived(product.name);
	const description = $derived(product.description ?? null);
	const imageUrl = $derived(product.imageUrl ?? null);
	const brand = $derived(product.brand ?? null);

	// Price fields only exist on NemligProduct
	const price = $derived('price' in product ? product.price : null);
	const campaignPrice = $derived('campaignPrice' in product ? product.campaignPrice : null);
	const discountSavings = $derived('discountSavings' in product ? product.discountSavings : null);
	const unitPrice = $derived('unitPrice' in product ? product.unitPrice : null);
	const isOnSale = $derived('isOnSale' in product ? product.isOnSale : false);
	const productUrl = $derived('url' in product ? product.url : null);

	function formatPrice(p: number): string {
		// Danish format: "33,95" → show as "33,95"
		// Nemlig prices are floats like 33.95
		const [int, dec] = p.toFixed(2).split('.');
		return dec === '00' ? `${int}` : `${int},${dec}`;
	}

	function formatSavings(s: number): string {
		if (Number.isInteger(s)) return `${s},-`;
		return `${formatPrice(s)}`;
	}
</script>

<div class="group relative flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden transition-shadow hover:shadow-md">
	<!-- Image area -->
	<div class="relative bg-zinc-50 aspect-square overflow-hidden">
		{#if imageUrl}
			<img
				src={imageUrl}
				alt={name}
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
		{#if showPrice && isOnSale && discountSavings}
			<div class="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-12 h-12 flex flex-col items-center justify-center leading-tight shadow">
				<span class="text-[9px] font-semibold">Save</span>
				<span class="text-sm font-black leading-none">{formatSavings(discountSavings)}</span>
			</div>
		{/if}
	</div>

	<!-- Card body -->
	<div class="flex flex-col gap-1 p-3 flex-1">
		<!-- Name -->
		<p class="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2">{name}</p>

		<!-- Description / brand -->
		{#if description || brand}
			<p class="text-xs text-zinc-500 leading-snug line-clamp-2">
				{#if description}{description}{/if}
			</p>
		{/if}
		<div class="mt-auto pt-2 flex items-end justify-between gap-2">
			<!-- Price block — only for search results -->
			{#if showPrice && price !== null}
				<div>
					{#if isOnSale && campaignPrice !== null}
						<div class="flex items-baseline gap-1.5">
							<span class="text-xl font-black text-zinc-900">{formatPrice(campaignPrice)}</span>
							<span class="text-sm text-zinc-400 line-through">{formatPrice(price)}</span>
						</div>
					{:else}
						<span class="text-xl font-black text-zinc-900">{formatPrice(price)}</span>
					{/if}
					{#if unitPrice}
						<p class="text-[10px] text-zinc-400">{unitPrice}</p>
					{/if}
				</div>
			{/if}
			<!-- Add to basket (placeholder) -->
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
