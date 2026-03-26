<script lang="ts">
	interface Props {
		imageUrl: string | null;
		name: string;
		/** Weight/size/volume string, e.g. "250 g / Danmark / Klasse 1" */
		meta?: string | null;
		quantity: number;
		price: number;
		/** If true: grey out + strikethrough + allow click to re-include */
		isDeselected?: boolean;
		/** If provided, wraps the product name in an <a> opening in a new tab */
		href?: string | null;
		/** Click handler — used for deselect/re-select in recipe card mode */
		onclick?: () => void;
	}

	let {
		imageUrl,
		name,
		meta = null,
		quantity,
		price,
		isDeselected = false,
		href = null,
		onclick,
	}: Props = $props();

	function formatPrice(p: number): string {
		const [int, dec] = p.toFixed(2).split('.');
		return dec === '00' ? `${int},-` : `${int},${dec}`;
	}

	const clickable = !!onclick;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="flex items-center gap-2 py-0.5 px-1 rounded transition-colors
		{isDeselected ? 'opacity-40' : ''}
		{clickable ? 'cursor-pointer select-none hover:bg-zinc-50' : ''}"
	onclick={clickable ? onclick : undefined}
	title={isDeselected ? 'Click to include' : clickable ? 'Click to exclude' : undefined}
>
	<!-- Tiny product image -->
	<div class="w-7 h-7 shrink-0 rounded overflow-hidden bg-zinc-100 flex items-center justify-center">
		{#if imageUrl}
			<img src={imageUrl} alt={name} class="w-full h-full object-contain" loading="lazy" />
		{:else}
			<div class="w-full h-full bg-zinc-100"></div>
		{/if}
	</div>

	<!-- Name + meta -->
	<div class="flex-1 min-w-0 leading-tight">
		{#if href}
			<a
				{href}
				target="_blank"
				rel="noopener noreferrer"
				class="text-xs font-medium text-zinc-800 hover:underline truncate block
					{isDeselected ? 'line-through text-zinc-400' : ''}"
				onclick={(e) => e.stopPropagation()}
			>{name}</a>
		{:else}
			<span class="text-xs font-medium text-zinc-800 truncate block
				{isDeselected ? 'line-through text-zinc-400' : ''}"
			>{name}</span>
		{/if}
		{#if meta}
			<span class="text-[10px] text-zinc-400 truncate block leading-tight">{meta}</span>
		{/if}
	</div>

	<!-- Quantity -->
	<span class="text-[10px] text-zinc-400 tabular-nums shrink-0">×{quantity}</span>

	<!-- Price -->
	<span class="text-xs font-medium tabular-nums shrink-0
		{isDeselected ? 'line-through text-zinc-400' : 'text-zinc-700'}"
	>{formatPrice(price)}</span>
</div>
