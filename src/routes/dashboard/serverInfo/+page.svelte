<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { socketManager, type ZoneInfo } from '$lib/socket';
	import { _getServerZones } from './get.remote';

	const { data } = $props();

	// 쿼리 파라미터에서 서버 정보 가져오기
	let serverId = $derived(page.url.searchParams.get('serverId') || '');
	let serverAlias = $derived(page.url.searchParams.get('serverAlias') || 'Unknown Server');

	// 상태
	let isConnected = $state(false);
	let zones: ZoneInfo[] = $derived(data.zones ?? []);
	let isLoading = $derived(!data.zones?.length && !data.error);
	let errorMessage = $derived(data.error ?? '');

	// 이벤트 리스너 정리를 위한 배열
	let eventCleanupFns: Array<() => void> = [];

	// Zones 목록 요청
	async function requestZones() {
		console.log('Zones 목록 요청 중...');
		if (!serverId) {
			errorMessage = '서버 ID가 없습니다.';
			isLoading = false;
			return;
		}

		isLoading = true;
		errorMessage = '';
		try {
			zones = await _getServerZones({ serverId });
		} catch (err) {
			console.error('Zones 정보를 가져오는 중 오류 발생:', err);
			errorMessage = err instanceof Error ? err.message : 'Zones 정보를 가져올 수 없습니다.';
			zones = [];
		} finally {
			isLoading = false;
		}
	}

	// 뒤로 가기
	function goBack() {
		goto('/dashboard');
	}

	onMount(() => {
		// 서버 ID가 없으면 대시보드로 리다이렉트
		if (!serverId) {
			goto('/dashboard');
			return;
		}

		if (zones.length === 0 && !errorMessage) {
			void requestZones();
		}
	});

	onDestroy(() => {
		// 이벤트 리스너만 정리 (소켓 연결은 유지)
		eventCleanupFns.forEach((cleanup) => cleanup());
		eventCleanupFns = [];
	});
</script>

<svelte:head>
	<title>Server Info - {serverAlias} - Pixel Server</title>
</svelte:head>

<div class="server-info-container">
	<!-- 헤더 -->
	<header class="header">
		<div class="header-left">
			<button class="btn btn-back" onclick={goBack} title="뒤로 가기">← 대시보드</button>
			<h1>서버 정보</h1>
			<div class="server-badge">
				<span class="status-indicator" class:connected={isConnected}></span>
				<span class="server-name">{serverAlias}</span>
			</div>
		</div>
		<div class="header-right">
			<button class="btn btn-primary" onclick={requestZones} disabled={!serverId || isLoading}>
				새로고침
			</button>
		</div>
	</header>

	<!-- 메인 콘텐츠 -->
	<main class="main-content">
		<!-- Zones 섹션 -->
		<section class="section">
			<div class="section-header">
				<h2>Zones</h2>
				<span class="server-count">{zones.length}개</span>
			</div>

			{#if isLoading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Zone 정보를 불러오는 중...</p>
				</div>
			{:else if errorMessage}
				<div class="error-state">
					<div class="error-icon">⚠️</div>
					<p>{errorMessage}</p>
					<button class="btn btn-primary" onclick={requestZones}>다시 시도</button>
				</div>
			{:else if zones.length === 0}
				<div class="empty-state">
					<div class="empty-icon">🌍</div>
					<p>Zone 정보가 없습니다.</p>
				</div>
			{:else}
				<div class="zones-grid">
					{#each zones as zone (zone.name)}
						<div class="zone-card">
							<div class="zone-header">
								<h3 class="zone-name">{zone.name}</h3>
								<span class="zone-status" class:active={zone.isActive}
									>{zone.isActive ? 'Active' : 'Inactive'}</span
								>
							</div>
							<div class="zone-stats">
								<div class="stat-item">
									<span class="stat-label">플레이어:</span>
									<span class="stat-value">{zone.playerCount}</span>
								</div>
								<!-- <div class="progress-bar">
									<div class="progress-fill" style="width: {getZoneOccupancyPercent(zone)}%"></div>
								</div> -->
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.server-info-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background-color: #1a1a2e;
		color: #ffffff;
	}

	/* 헤더 */
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		background-color: #16213e;
		border-bottom: 1px solid #0f3460;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.header h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: bold;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.server-badge {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		background-color: #1a1a2e;
		border-radius: 6px;
		border: 1px solid #0f3460;
	}

	.server-name {
		font-size: 0.875rem;
		color: #f39c12;
		font-weight: 600;
	}

	.status-indicator {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background-color: #e74c3c;
	}

	.status-indicator.connected {
		background-color: #2ecc71;
	}

	/* 버튼 */
	.btn {
		padding: 8px 16px;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 0.2s,
			transform 0.1s;
	}

	.btn:hover:not(:disabled) {
		transform: translateY(-1px);
	}

	.btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: #3498db;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #2980b9;
	}

	.btn-back {
		background-color: #7f8c8d;
		color: white;
	}

	.btn-back:hover {
		background-color: #6c7a7d;
	}

	/* 메인 콘텐츠 */
	.main-content {
		flex: 1;
		padding: 24px;
	}

	/* 섹션 */
	.section {
		background-color: #16213e;
		border-radius: 12px;
		padding: 20px;
		border: 1px solid #0f3460;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.server-count {
		font-size: 0.875rem;
		color: #2ecc71;
		background-color: rgba(46, 204, 113, 0.15);
		padding: 4px 12px;
		border-radius: 12px;
	}

	/* 상태 표시 */
	.loading-state,
	.empty-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		color: #7f8c8d;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #0f3460;
		border-top: 4px solid #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.empty-icon,
	.error-icon {
		font-size: 3rem;
		margin-bottom: 16px;
	}

	.error-state {
		color: #e74c3c;
	}

	.error-state p {
		margin-bottom: 16px;
	}

	.loading-state p,
	.empty-state p,
	.error-state p {
		margin: 0;
		font-size: 1rem;
	}

	/* Zones 그리드 */
	.zones-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	.zone-card {
		padding: 16px;
		background-color: #1a1a2e;
		border-radius: 8px;
		border: 1px solid #0f3460;
		transition: border-color 0.2s;
	}

	.zone-card:hover {
		border-color: #3498db;
	}

	.zone-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.zone-name {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #3498db;
	}

	.zone-status {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		background-color: #7f8c8d;
		color: white;
		text-transform: uppercase;
	}

	.zone-status.active {
		background-color: #2ecc71;
	}

	.zone-stats {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.stat-item {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
	}

	.stat-label {
		color: #7f8c8d;
	}

	.stat-value {
		color: #ecf0f1;
		font-weight: 600;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background-color: #0f3460;
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #3498db 0%, #2ecc71 100%);
		transition: width 0.3s ease;
	}
</style>
