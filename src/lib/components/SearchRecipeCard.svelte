<script lang="ts">
	import type { NemligRecipe } from '$lib/types';
	import { formatTime } from '$lib/format';

	interface Props {
		recipe: NemligRecipe;
		isFavorite: boolean;
		onToggleFavorite: (recipe: NemligRecipe) => void;
	}

	let { recipe, isFavorite, onToggleFavorite }: Props = $props();
</script>

<div class="group relative flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden transition-shadow hover:shadow-md">
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

	<div class="flex flex-col gap-1 p-3 flex-1">
		{#if recipe.url}
			<a
				href={recipe.url}
				target="_blank"
				rel="noopener noreferrer"
				class="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2 hover:underline"
			>{recipe.name}</a>
		{:else}
			<p class="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2">{recipe.name}</p>
		{/if}
	</div>

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
