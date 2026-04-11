<script lang="ts">
	import { formatPrice } from '$lib/format';

	interface Props {
		imageUrl: string | null;
		name: string;
		meta?: string | null;
		quantity: number;
		price: number;
		isDeselected?: boolean;
		isCustom?: boolean;
		href?: string | null;
		onToggleDeselect?: () => void;
		onQuantityChange?: (value: string) => void;
		onRemove?: () => void;
	}

	let {
		imageUrl,
		name,
		meta = null,
		quantity,
		price,
		isDeselected = false,
		isCustom = false,
		href = null,
		onToggleDeselect,
		onQuantityChange,
		onRemove,
	}: Props = $props();
</script>

<div class="flex items-center gap-2 py-0.5 px-1 rounded {isDeselected ? 'opacity-40' : ''}">
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

	<!-- Quantity (editable if onQuantityChange provided) -->
	{#if onQuantityChange}
		<input
			type="number"
			min="1"
			value={quantity}
			oninput={(e) => onQuantityChange((e.target as HTMLInputElement).value)}
			class="w-10 text-center text-xs border border-zinc-200 rounded py-0.5 tabular-nums
				focus:outline-none focus:border-zinc-400 {isDeselected ? 'opacity-50' : ''}"
		/>
	{:else}
		<span class="text-[10px] text-zinc-400 tabular-nums shrink-0">×{quantity}</span>
	{/if}

	<!-- Price -->
	<span class="text-xs font-medium tabular-nums shrink-0
		{isDeselected ? 'line-through text-zinc-400' : 'text-zinc-700'}"
	>{formatPrice(price)}</span>

	<!-- Deselect toggle -->
	{#if onToggleDeselect}
		<button
			type="button"
			onclick={onToggleDeselect}
			title={isDeselected ? 'Include' : 'Exclude'}
			class="shrink-0 text-zinc-300 hover:text-zinc-600 transition-colors"
		>
			{#if isDeselected}
				<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<path d="M12 8v8M8 12h8"/>
				</svg>
			{:else}
				<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<path d="M8 12h8"/>
				</svg>
			{/if}
		</button>
	{/if}

	<!-- Remove button -->
	{#if onRemove}
		<button
			type="button"
			onclick={onRemove}
			title="Remove ingredient"
			class="shrink-0 text-zinc-300 hover:text-red-400 transition-colors"
		>
			<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12"/>
			</svg>
		</button>
	{/if}
</div>
