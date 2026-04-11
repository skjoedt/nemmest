<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import 'uplot/dist/uPlot.min.css';
	import { formatPrice } from '$lib/format';

	interface Props {
		recipeId: string;
	}

	let { recipeId }: Props = $props();

	interface HistoryPoint {
		date: string;
		price: number;
	}

	type Status = 'loading' | 'empty' | 'done' | 'error';
	let status = $state<Status>('loading');
	let history = $state<HistoryPoint[]>([]);
	let low30 = $state<number | null>(null);

	let chartEl = $state<HTMLDivElement | undefined>(undefined);
	let chart: uPlot | null = null;

	async function loadHistory() {
		status = 'loading';
		try {
			const res = await fetch(
				`/api/recipes/price-history?recipeId=${encodeURIComponent(recipeId)}`,
			);
			if (!res.ok) { status = 'error'; return; }
			const data = (await res.json()) as { history: HistoryPoint[]; low30: number | null };
			history = data.history;
			low30 = data.low30;
			status = history.length === 0 ? 'empty' : 'done';
		} catch {
			status = 'error';
		}
	}

	function buildChart(el: HTMLDivElement) {
		if (chart) { chart.destroy(); chart = null; }
		if (history.length === 0) return;

		const xs = history.map((p) => Date.parse(p.date) / 1000);
		const ys = history.map((p) => p.price);

		const minPrice = Math.min(...ys);
		const maxPrice = Math.max(...ys);
		const padding = (maxPrice - minPrice) * 0.15 || 2;

		const opts: uPlot.Options = {
			width: el.clientWidth || 320,
			height: 160,
			cursor: { show: true, points: { size: 6 } },
			legend: { show: false },
			scales: {
				x: { time: true },
				y: { range: [Math.max(0, minPrice - padding), maxPrice + padding] },
			},
			axes: [
				{
					stroke: '#a1a1aa',
					ticks: { stroke: '#e4e4e7', width: 1 },
					grid: { stroke: '#f4f4f5', width: 1 },
					values: (_, ticks) =>
						ticks.map((t) => {
							const d = new Date(t * 1000);
							return `${d.getDate()}/${d.getMonth() + 1}`;
						}),
					size: 28,
					font: '11px system-ui, sans-serif',
					labelFont: '11px system-ui, sans-serif',
				},
				{
					stroke: '#a1a1aa',
					ticks: { stroke: '#e4e4e7', width: 1 },
					grid: { stroke: '#f4f4f5', width: 1 },
					values: (_, ticks) => ticks.map((v) => `${v.toFixed(0)}`),
					size: 40,
					font: '11px system-ui, sans-serif',
					labelFont: '11px system-ui, sans-serif',
				},
			],
			series: [
				{},
				{
					stroke: '#18181b',
					width: 2,
					fill: 'rgba(24,24,27,0.06)',
					points: { show: history.length <= 14, size: 4, stroke: '#18181b', fill: '#fff', width: 1.5 },
				},
			],
		};

		chart = new uPlot(opts, [xs, ys], el);
	}

	$effect(() => {
		if (status === 'done' && chartEl) {
			requestAnimationFrame(() => {
				if (chartEl) buildChart(chartEl);
			});
		}
	});

	onMount(() => { loadHistory(); });
	onDestroy(() => { chart?.destroy(); });
</script>

<div class="mt-3 border-t border-zinc-100 pt-3">
	{#if status === 'loading'}
		<div class="flex items-center justify-center h-20 text-zinc-400">
			<svg class="size-4 animate-spin mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
			</svg>
			<span class="text-xs">Loading price history…</span>
		</div>
	{:else if status === 'error'}
		<p class="text-xs text-red-500 py-2">Could not load price history.</p>
	{:else if status === 'empty'}
		<p class="text-xs text-zinc-400 py-2 text-center leading-relaxed">
			No price history yet.<br/>Prices are recorded daily at 06:00.
		</p>
	{:else}
		<div bind:this={chartEl} class="w-full overflow-hidden rounded"></div>

		{#if low30 !== null}
			<div class="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
				<svg class="size-3.5 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
					<polyline points="17 6 23 6 23 12"/>
				</svg>
				<span>30-day low: <span class="font-semibold text-zinc-800">{formatPrice(low30)}</span></span>
			</div>
		{/if}
	{/if}
</div>
