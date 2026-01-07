<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let { children } = $props();
	let isDrawerOpen = $state(true);

	// Navigation items - resolve routes in advance
	const navItems = [
		{ path: '/', href: resolve('/'), label: 'Home', icon: '🏠' },
		{ path: '/console', href: resolve('/console'), label: 'Console', icon: '💻' },
		{ path: '/dashboard', href: resolve('/dashboard'), label: 'Dashboard', icon: '📊' },
		{ path: '/test', href: resolve('/test'), label: 'Test', icon: '🧪' }
	];

	function toggleDrawer() {
		isDrawerOpen = !isDrawerOpen;
	}

	// 클라이언트 측에서만 소켓 매니저 초기화
	onMount(async () => {
		if (browser) {
			const { socketManager } = await import('$lib/socket');
			socketManager.connect();
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-container">
	<!-- Drawer -->
	<aside class="drawer" class:collapsed={!isDrawerOpen}>
		<div class="drawer-header">
			<h2 class="drawer-title">Pixel Server</h2>
			<button class="toggle-btn" onclick={toggleDrawer} aria-label="Toggle drawer">
				{isDrawerOpen ? '◀' : '▶'}
			</button>
		</div>
		<nav class="drawer-nav">
			{#each navItems as item (item.path)}
				<a
					href={item.href}
					class="nav-item"
					class:active={page.url.pathname === item.path}
					title={item.label}
				>
					<span class="nav-icon">{item.icon}</span>
					{#if isDrawerOpen}
						<span class="nav-label">{item.label}</span>
					{/if}
				</a>
			{/each}
		</nav>
	</aside>

	<!-- Main Content -->
	<main class="main-content">
		{@render children()}
	</main>
</div>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background-color: #1a1a2e;
		color: #ffffff;
	}

	.app-container {
		display: flex;
		min-height: 100vh;
	}

	/* Drawer styles */
	.drawer {
		width: 240px;
		background-color: #16213e;
		border-right: 1px solid #0f3460;
		display: flex;
		flex-direction: column;
		transition: width 0.3s ease;
		flex-shrink: 0;
	}

	.drawer.collapsed {
		width: 60px;
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid #0f3460;
		min-height: 60px;
	}

	.drawer-title {
		margin: 0;
		font-size: 1.25rem;
		font-weight: bold;
		color: #3498db;
		white-space: nowrap;
		overflow: hidden;
	}

	.drawer.collapsed .drawer-title {
		display: none;
	}

	.toggle-btn {
		background: transparent;
		border: none;
		color: #a0a0a0;
		cursor: pointer;
		padding: 8px;
		border-radius: 4px;
		transition: background-color 0.2s;
		font-size: 0.875rem;
	}

	.toggle-btn:hover {
		background-color: #0f3460;
		color: #ffffff;
	}

	/* Navigation styles */
	.drawer-nav {
		display: flex;
		flex-direction: column;
		padding: 8px;
		gap: 4px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: 8px;
		text-decoration: none;
		color: #a0a0a0;
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.nav-item:hover {
		background-color: #0f3460;
		color: #ffffff;
	}

	.nav-item.active {
		background-color: #3498db;
		color: #ffffff;
	}

	.nav-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.nav-label {
		white-space: nowrap;
		overflow: hidden;
	}

	.drawer.collapsed .nav-item {
		justify-content: center;
	}

	/* Main content styles */
	.main-content {
		flex: 1;
		overflow: auto;
		background-color: #1a1a2e;
	}
</style>
