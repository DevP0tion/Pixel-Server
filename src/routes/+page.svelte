<script lang="ts">
	import { resolveRoute } from '$app/paths';

	const consoleRoute = resolveRoute('/console', {});
	const dashboardRoute = resolveRoute('/dashboard', {});
</script>

<svelte:head>
	<title>Home - Pixel Server</title>
</svelte:head>

<div class="home-container">
	<header class="hero">
		<h1>Pixel Server</h1>
		<p class="subtitle">실시간 게임 서버 관리 시스템</p>
	</header>

	<section class="features">
		<div class="feature-card">
			<div class="feature-icon">💻</div>
			<h3>Console</h3>
			<p>서버 명령어를 실행하고 실시간 로그를 확인하세요.</p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href is pre-resolved with resolveRoute -->
			<a href={consoleRoute} class="feature-link">콘솔 열기 →</a>
		</div>

		<div class="feature-card">
			<div class="feature-icon">📊</div>
			<h3>Dashboard</h3>
			<p>Unity 서버 상태를 모니터링하고 관리하세요.</p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href is pre-resolved with resolveRoute -->
			<a href={dashboardRoute} class="feature-link">대시보드 열기 →</a>
		</div>
	</section>

	<footer class="home-footer">
		<p>Powered by SvelteKit & Socket.IO</p>
	</footer>
</div>

<style>
	.home-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		padding: 24px;
	}

	.hero {
		text-align: center;
		padding: 48px 24px;
		margin-bottom: 32px;
	}

	.hero h1 {
		margin: 0;
		font-size: 3rem;
		font-weight: bold;
		color: #3498db;
		margin-bottom: 16px;
	}

	.subtitle {
		margin: 0;
		font-size: 1.25rem;
		color: #a0a0a0;
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 24px;
		max-width: 800px;
		margin: 0 auto;
		width: 100%;
	}

	.feature-card {
		background-color: #16213e;
		border: 1px solid #0f3460;
		border-radius: 12px;
		padding: 24px;
		transition:
			border-color 0.2s,
			transform 0.2s;
	}

	.feature-card:hover {
		border-color: #3498db;
		transform: translateY(-4px);
	}

	.feature-icon {
		font-size: 2.5rem;
		margin-bottom: 16px;
	}

	.feature-card h3 {
		margin: 0 0 12px 0;
		font-size: 1.25rem;
		color: #ffffff;
	}

	.feature-card p {
		margin: 0 0 16px 0;
		color: #a0a0a0;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.feature-link {
		color: #3498db;
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		transition: color 0.2s;
	}

	.feature-link:hover {
		color: #2980b9;
	}

	.home-footer {
		margin-top: auto;
		text-align: center;
		padding: 24px;
	}

	.home-footer p {
		margin: 0;
		color: #7f8c8d;
		font-size: 0.875rem;
	}
</style>
