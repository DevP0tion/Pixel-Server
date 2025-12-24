<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { type ZoneInfo } from '$lib/socket';
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
			<button
				class="btn btn-primary refresh-btn"
				class:is-loading={isLoading}
				onclick={requestZones}
				disabled={!serverId || isLoading}
				aria-busy={isLoading}
			>
				<span class="refresh-icon" aria-hidden="true">⟳</span>
				<span class="refresh-label">새로고침</span>
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
					{#each zones as zone (zone.id)}
						<div class="zone-card">
							<div class="zone-header">
								<h3 class="zone-name">Zone - {zone.id}</h3>
								<span class="zone-status" class:active={zone.playerCount > 0}
									>{zone.playerCount > 0 ? 'Active' : 'Inactive'}</span
								>
							</div>
							<div class="zone-stats">
								<div class="stat-item">
									<span class="stat-label">플레이어:</span>
									<span class="stat-value">{zone.playerCount}</span>
								</div>
							</div>
							{#if zone.additionalInfo?.length}
								<div class="additional-info">
									<div class="info-title">추가 정보</div>
									<ul>
										{#each zone.additionalInfo as info, index (index)}
											<li>
												<span class="dot"></span>
												<span class="info-text">{info}</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</main>
</div>

<style lang="scss">
	@use 'sass:color';

	$bg-main: #0d1329;
	$bg-surface: #111a32;
	$bg-card: #0f1c3a;
	$panel-border: #1f2a4a;
	$text: #e7eefc;
	$text-muted: #9fb0d5;

	$accent-blue: #3b82f6;
	$accent-cyan: #06b6d4;
	$accent-orange: #f59e0b;
	$accent-green: #10b981;
	$accent-red: #ef4444;

	%pill {
		padding: 6px 12px;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.01em;
	}

	%card {
		background: linear-gradient(
			160deg,
			color.adjust($bg-surface, $lightness: 4%),
			color.adjust($bg-card, $lightness: -2%)
		);
		border: 1px solid $panel-border;
		border-radius: 16px;
		box-shadow: 0 14px 50px rgba(0, 0, 0, 0.35);
	}

	%state-block {
		@extend %card;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		text-align: center;
		gap: 12px;
		border-style: dashed;
		border-color: color.adjust($panel-border, $lightness: 12%);
		color: $text-muted;

		p {
			margin: 0;
			font-size: 1rem;
		}
	}

	:global(body) {
		margin: 0;
		padding: 0;
		background-color: $bg-main;
		color: $text;
		font-family:
			'Space Grotesk',
			'Noto Sans KR',
			'Segoe UI',
			-apple-system,
			system-ui,
			sans-serif;
	}

	.server-info-container {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 12px 20px 32px;
		background:
			radial-gradient(circle at 20% 20%, rgba($accent-blue, 0.08), transparent 35%),
			radial-gradient(circle at 80% 10%, rgba($accent-cyan, 0.08), transparent 30%), $bg-main;

		.header {
			@extend %card;
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 12px;
			padding: 16px 18px;
			backdrop-filter: blur(4px);

			h1 {
				margin: 0;
				font-size: 1.4rem;
				font-weight: 800;
				letter-spacing: -0.02em;
			}

			.header-left {
				display: flex;
				align-items: center;
				gap: 12px;
				flex-wrap: wrap;

				.server-badge {
					@extend %pill;
					display: flex;
					align-items: center;
					gap: 10px;
					background: rgba($bg-card, 0.6);
					border: 1px solid $panel-border;
					box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
				}

				.status-indicator {
					width: 12px;
					height: 12px;
					border-radius: 50%;
					background-color: $accent-red;
					box-shadow: 0 0 0 6px rgba($accent-red, 0.12);

					&.connected {
						background-color: $accent-green;
						box-shadow: 0 0 0 6px rgba($accent-green, 0.18);
					}
				}

				.server-name {
					font-size: 0.95rem;
					color: $accent-orange;
					font-weight: 700;
				}
			}

			.header-right {
				display: flex;
				align-items: center;
				gap: 10px;
			}
		}

		.btn {
			padding: 9px 14px;
			border: 1px solid transparent;
			border-radius: 12px;
			font-size: 0.95rem;
			font-weight: 700;
			background: rgba($text, 0.04);
			color: $text;
			cursor: pointer;
			transition:
				transform 0.15s ease,
				box-shadow 0.25s ease,
				background-color 0.2s ease,
				border-color 0.2s ease,
				opacity 0.2s ease;

			&:hover:not(:disabled) {
				transform: translateY(-1px);
				box-shadow: 0 10px 32px rgba(0, 0, 0, 0.3);
				background: rgba($text, 0.07);
			}

			&:active:not(:disabled) {
				transform: translateY(0);
				box-shadow: none;
			}

			&:disabled {
				opacity: 0.55;
				cursor: not-allowed;
			}

			&.btn-primary {
				background: linear-gradient(135deg, $accent-blue, $accent-cyan);
				color: #0b1227;
				border-color: color.adjust($accent-blue, $lightness: -10%);
				text-shadow: 0 1px 0 rgba(255, 255, 255, 0.2);

				&:hover:not(:disabled) {
					background: linear-gradient(
						135deg,
						color.adjust($accent-blue, $lightness: 6%),
						color.adjust($accent-cyan, $lightness: 6%)
					);
					box-shadow: 0 12px 40px rgba($accent-blue, 0.35);
				}
			}

			&.btn-back {
				background: rgba($accent-orange, 0.12);
				color: $accent-orange;
				border-color: color.adjust($accent-orange, $lightness: -8%);

				&:hover:not(:disabled) {
					border-color: color.adjust($accent-orange, $lightness: 4%);
				}
			}
		}

		.refresh-btn {
			display: inline-flex;
			align-items: center;
			gap: 8px;

			.refresh-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1em;
				height: 1em;
				font-size: 1em;
				line-height: 1;
				transform-origin: 50% 50%;
			}

			&.is-loading .refresh-icon {
				animation: spin 0.8s linear infinite;
			}
		}

		.main-content {
			flex: 1;
			width: 100%;
			max-width: 1200px;
			align-self: center;
			padding: 8px 0 0;
		}

		.section {
			@extend %card;
			padding: 20px;
			border: 1px solid color.adjust($panel-border, $lightness: 6%);

			.section-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 12px;
				margin-bottom: 18px;

				h2 {
					margin: 0;
					font-size: 1.2rem;
					font-weight: 700;
				}

				.server-count {
					@extend %pill;
					background: rgba($accent-green, 0.16);
					border: 1px solid rgba($accent-green, 0.45);
					color: $accent-green;
				}
			}
		}

		.loading-state,
		.empty-state,
		.error-state {
			@extend %state-block;
		}

		.loading-state {
			color: $text-muted;
		}

		.spinner {
			width: 42px;
			height: 42px;
			border: 4px solid $panel-border;
			border-top: 4px solid $accent-blue;
			border-radius: 50%;
			animation: spin 1s linear infinite;
			margin-bottom: 10px;
		}

		.empty-icon,
		.error-icon {
			font-size: 2.4rem;
			margin-bottom: 6px;
		}

		.error-state {
			color: $accent-red;
			border-color: rgba($accent-red, 0.4);

			.error-icon {
				filter: drop-shadow(0 6px 18px rgba($accent-red, 0.25));
			}
		}

		.loading-state p,
		.empty-state p,
		.error-state p {
			color: inherit;
		}

		.zones-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
			gap: 14px;
		}

		.zone-card {
			@extend %card;
			padding: 14px;
			border: 1px solid color.adjust($panel-border, $lightness: 10%);
			background: linear-gradient(
				160deg,
				color.adjust($bg-card, $lightness: 4%),
				color.adjust($bg-card, $lightness: -3%)
			);
			transition:
				border-color 0.2s ease,
				transform 0.16s ease,
				box-shadow 0.25s ease;

			&:hover {
				border-color: $accent-blue;
				transform: translateY(-2px);
				box-shadow: 0 16px 42px rgba($accent-blue, 0.25);
			}

			.zone-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 10px;
				margin-bottom: 10px;

				.zone-name {
					margin: 0;
					font-size: 1.05rem;
					font-weight: 700;
					color: $accent-blue;
					text-shadow: 0 0 10px rgba($accent-blue, 0.18);
				}

				.zone-status {
					@extend %pill;
					background: rgba($text, 0.06);
					border: 1px solid $panel-border;
					color: $text-muted;
					text-transform: uppercase;
					font-size: 0.72rem;
					letter-spacing: 0.06em;

					&.active {
						background: rgba($accent-green, 0.12);
						border-color: rgba($accent-green, 0.6);
						color: $accent-green;
					}
				}
			}

			.zone-stats {
				display: flex;
				flex-direction: column;
				gap: 8px;

				.stat-item {
					display: flex;
					justify-content: space-between;
					font-size: 0.92rem;
				}

				.stat-label {
					color: $text-muted;
				}

				.stat-value {
					color: $text;
					font-weight: 700;
				}
			}

			.additional-info {
				margin-top: 12px;
				padding: 12px;
				border-radius: 12px;
				background: rgba($bg-surface, 0.65);
				border: 1px solid color.adjust($panel-border, $lightness: 12%);
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);

				.info-title {
					margin-bottom: 6px;
					font-size: 0.9rem;
					font-weight: 700;
					color: $text-muted;
					letter-spacing: 0.01em;
				}

				ul {
					margin: 0;
					padding: 0;
					list-style: none;
					display: flex;
					flex-direction: column;
					gap: 8px;
				}

				li {
					display: flex;
					align-items: flex-start;
					gap: 8px;
					color: $text;
					font-size: 0.9rem;
					line-height: 1.35;
				}

				.dot {
					width: 8px;
					height: 8px;
					margin-top: 6px;
					border-radius: 50%;
					background: linear-gradient(135deg, $accent-blue, $accent-cyan);
					box-shadow: 0 0 0 6px rgba($accent-blue, 0.08);
					flex-shrink: 0;
				}

				.info-text {
					flex: 1;
				}
			}
		}
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 768px) {
		.server-info-container {
			padding: 10px 14px 28px;

			.header {
				flex-direction: column;
				align-items: stretch;

				.header-left,
				.header-right {
					width: 100%;
					justify-content: space-between;
				}
			}

			.section {
				padding: 16px;
			}
		}
	}
</style>
