<script>
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Home' },
		{ href: '/recipes', label: 'Recipes' },
		{ href: '/products', label: 'Products' },
		{ href: '/settings', label: 'Settings' },
	];
</script>

<div class="min-h-full flex flex-col">
	<header class="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-sm">
		<div class="mx-auto flex h-14 max-w-4xl items-center justify-start gap-x-4 px-6">
			<a href="/" class="text-sm font-semibold tracking-tight text-zinc-900">nemmest</a>
			<nav class="flex gap-1">
				{#each nav as { href, label }}
					<a
						{href}
						class="rounded-md px-3 py-1.5 text-sm transition-colors
							{page.url.pathname === href
								? 'bg-zinc-900 text-white'
								: 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}"
					>
						{label}
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<main class="mx-auto w-full max-w-4xl flex-1 px-6 py-2">
		{@render children()}
	</main>
</div>
