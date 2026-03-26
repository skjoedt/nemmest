<script lang="ts">
	import { onMount } from 'svelte';
	import type { BasketLine } from '$lib/types';

	// ── State ────────────────────────────────────────────────────────────────

	type Status = 'checking' | 'unauthenticated' | 'loading' | 'error' | 'done';
	let status = $state<Status>('checking');
	let lines = $state<BasketLine[]>([]);
	let totalProductsPrice = $state(0);
	let error = $state('');

	// ── Lifecycle ────────────────────────────────────────────────────────────

	onMount(async () => {
		try {
			const res = await fetch('/api/nemlig/session');
			if (!res.ok) { status = 'unauthenticated'; return; }
		} catch {
			status = 'unauthenticated'; return;
		}

		status = 'loading';
		try {
			const res = await fetch('/api/nemlig/basket/GetBasket');
			const data = await res.json() as {
				Lines?: BasketLine[];
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
			totalProductsPrice = data.TotalProductsPrice ?? 0;
			status = 'done';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not load basket.';
			status = 'error';
		}
	});

	// ── Formatting ───────────────────────────────────────────────────────────

	function fmt(n: number): string {
		const [int, dec] = n.toFixed(2).split('.');
		return dec === '00' ? `${int},-` : `${int},${dec}`;
	}
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
	{:else if lines.length === 0}
		<div class="rounded-xl border border-dashed border-zinc-200 px-6 py-10 text-center">
			<svg class="mx-auto size-8 text-zinc-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
				<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
			</svg>
			<p class="text-sm text-zinc-400">Your basket is empty.</p>
		</div>

	<!-- Basket lines -->
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
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-100">
					{#each lines as line (line.Id)}
						<tr class="hover:bg-zinc-50 transition-colors">
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
							<!-- Quantity -->
							<td class="px-4 py-3 text-right text-zinc-900 font-medium">{line.Quantity}</td>
							<!-- Line total -->
							<td class="px-4 py-3 text-right font-semibold text-zinc-900 whitespace-nowrap">{fmt(line.ItemPrice * line.Quantity)} kr.</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="border-t border-zinc-200 bg-zinc-50">
						<td colspan="4" class="px-4 py-3 text-sm font-medium text-zinc-500">Total</td>
						<td class="px-4 py-3 text-right text-base font-bold text-zinc-900 whitespace-nowrap">{fmt(totalProductsPrice)} kr.</td>
					</tr>
				</tfoot>
			</table>
		</div>
	{/if}

</div>
