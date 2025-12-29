<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { socketManager, type UnityServerInfo } from '$lib/socket';
	import { _getUnityServers } from './get.remote';

	const { data } = $props();
	let unityServers = $derived(data.unityServers);

	// Unity 서버 기본 별칭
	const DEFAULT_UNITY_ALIAS = 'Game Server';

	// 상태
	let isConnected = $state(false);

	// 별칭 편집 상태
	let editingServerId: string | null = $state(null);
	let editingAlias = $state('');

	// 이벤트 리스너 정리를 위한 배열
	let eventCleanupFns: Array<() => void> = [];

	// 이벤트 핸들러 등록
	function setupSocketEventHandlers() {
		// 이벤트 리스너 헬퍼 함수
		function addEventHandler(event: string, handler: (...args: unknown[]) => void) {
			socketManager.on(event, handler);
			eventCleanupFns.push(() => socketManager.off(event, handler));
		}

		addEventHandler('connect', () => {
			isConnected = true;
		});

		// Unity 서버 강제 연결 해제 응답
		addEventHandler('unity:disconnect:response', (response: unknown) => {
			const res = response as { code: number; message: string };
			if (res.code === 100) {
				console.log(res.message);
			} else {
				console.error(res.message);
			}
		});

		// Unity 서버 별칭 변경 응답
		addEventHandler('unity:set-alias:response', (response: unknown) => {
			const res = response as { code: number; message: string };
			if (res.code === 100) {
				console.log(res.message);
				editingServerId = null;
				editingAlias = '';
			} else {
				console.error(res.message);
			}
		});
	}

	// 소켓 재연결
	async function refreshDashboard() {
		unityServers = await _getUnityServers(undefined);
	}

	// Unity 서버 강제 중지
	function stopUnityServer(unitySocketId: string) {
		if (isConnected) {
			socketManager.sendUnityEvent('server:stop', { unitySocketId });
		}
	}

	// 별칭 편집 시작
	function startEditAlias(server: UnityServerInfo) {
		editingServerId = server.id;
		editingAlias = server.alias;
	}

	// 별칭 편집 취소
	function cancelEditAlias() {
		editingServerId = null;
		editingAlias = '';
	}

	// 별칭 저장
	function saveAlias(unitySocketId: string) {
		if (isConnected) {
			socketManager.sendUnityEvent('unity:set-alias', {
				unitySocketId,
				alias: editingAlias.trim() || DEFAULT_UNITY_ALIAS
			});
		}
	}

	// 별칭 편집 키보드 핸들러
	function handleAliasKeydown(event: KeyboardEvent, serverId: string) {
		if (event.key === 'Enter') {
			saveAlias(serverId);
		} else if (event.key === 'Escape') {
			cancelEditAlias();
		}
	}

	// 시간 포맷
	function formatTime(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleString('ko-KR', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	// 연결 시간 계산
	function getConnectionDuration(isoString: string): string {
		const connectedAt = new Date(isoString);
		const now = new Date();
		const diffMs = now.getTime() - connectedAt.getTime();
		const diffSec = Math.floor(diffMs / 1000);
		const diffMin = Math.floor(diffSec / 60);
		const diffHour = Math.floor(diffMin / 60);

		if (diffHour > 0) {
			return `${diffHour}시간 ${diffMin % 60}분`;
		} else if (diffMin > 0) {
			return `${diffMin}분 ${diffSec % 60}초`;
		} else {
			return `${diffSec}초`;
		}
	}

	// 서버 정보 페이지로 이동
	function viewServerInfo(server: UnityServerInfo) {
		const params = new URLSearchParams({
			serverId: server.id,
			serverAlias: server.alias
		});
		goto(`/dashboard/serverInfo?${params.toString()}`);
	}

	onMount(() => {
		// 현재 연결 상태 동기화
		isConnected = socketManager.isConnected;

		// 이벤트 핸들러 등록
		setupSocketEventHandlers();

		// 아직 연결되지 않은 경우 연결 시도
		if (!isConnected) {
			socketManager.connect();
		}
	});

	onDestroy(() => {
		// 이벤트 리스너만 정리 (소켓 연결은 유지)
		eventCleanupFns.forEach((cleanup) => cleanup());
		eventCleanupFns = [];
	});
</script>

<svelte:head>
	<title>Dashboard - Pixel Server</title>
</svelte:head>

<div class="dashboard-container">
	<!-- 헤더 -->
	<header class="header">
		<div class="header-left">
			<h1>Pixel Server Dashboard</h1>
			<div class="connection-status">
				<span class="status-indicator" class:connected={isConnected}></span>
				<span class="status-text">{isConnected ? '서버 연결됨' : '서버 연결 끊김'}</span>
			</div>
		</div>
		<div class="header-right">
			<button class="btn btn-primary" onclick={refreshDashboard}>새로고침</button>
		</div>
	</header>

	<!-- 메인 콘텐츠 -->
	<main class="main-content">
		<!-- Unity 서버 섹션 -->
		<section class="section">
			<div class="section-header">
				<h2>Unity 서버</h2>
				<span class="server-count">{unityServers.length}개 연결됨</span>
			</div>

			{#if unityServers.length === 0}
				<div class="empty-state">
					<div class="empty-icon">🎮</div>
					<p>연결된 Unity 서버가 없습니다.</p>
				</div>
			{:else}
				<div class="server-list">
					{#each unityServers as server (server.id)}
						<div class="server-card">
							<div class="server-info">
								<div class="server-alias">
									{#if editingServerId === server.id}
										<input
											type="text"
											class="alias-input"
											bind:value={editingAlias}
											onkeydown={(e) => handleAliasKeydown(e, server.id)}
											placeholder="Game Server"
										/>
										<button
											class="btn btn-small btn-success"
											onclick={() => saveAlias(server.id)}
											title="저장"
										>
											✓
										</button>
										<button
											class="btn btn-small btn-secondary"
											onclick={cancelEditAlias}
											title="취소"
										>
											✗
										</button>
									{:else}
										<span class="alias-text">{server.alias}</span>
										<button
											class="btn btn-small btn-edit"
											onclick={() => startEditAlias(server)}
											title="별칭 편집"
										>
											✎
										</button>
									{/if}
								</div>
								<div class="server-id">
									<span class="status-dot"></span>
									<span class="id-text">{server.id}</span>
								</div>
								<div class="server-details">
									<div class="detail-item">
										<span class="detail-label">연결 시간:</span>
										<span class="detail-value">{formatTime(server.connectedAt)}</span>
									</div>
									<div class="detail-item">
										<span class="detail-label">연결 유지:</span>
										<span class="detail-value">{getConnectionDuration(server.connectedAt)}</span>
									</div>
								</div>
							</div>
							<div class="server-actions">
								<button
									class="btn btn-info"
									onclick={() => viewServerInfo(server)}
									title="서버 상세 정보 보기"
								>
									서버 정보
								</button>
								<button
									class="btn btn-danger"
									onclick={() => stopUnityServer(server.id)}
									title="Unity 서버 강제 중지"
								>
									서버 중지
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</main>
</div>

<style lang="scss">
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.dashboard-container {
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

		&-left {
			display: flex;
			align-items: center;
			gap: 16px;
		}

		&-right {
			display: flex;
			align-items: center;
			gap: 12px;
		}

		h1 {
			margin: 0;
			font-size: 1.5rem;
			font-weight: bold;
		}
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-indicator {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background-color: #e74c3c;

		&.connected {
			background-color: #2ecc71;
		}
	}

	.status-text {
		font-size: 0.875rem;
		color: #a0a0a0;
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

		&:hover {
			transform: translateY(-1px);
		}

		&:active {
			transform: translateY(0);
		}
	}

	.btn-primary {
		background-color: #3498db;
		color: white;

		&:hover {
			background-color: #2980b9;
		}
	}

	.btn-danger {
		background-color: #e74c3c;
		color: white;

		&:hover {
			background-color: #c0392b;
		}
	}

	.btn-success {
		background-color: #27ae60;
		color: white;

		&:hover {
			background-color: #219a52;
		}
	}

	.btn-secondary {
		background-color: #7f8c8d;
		color: white;

		&:hover {
			background-color: #6c7a7d;
		}
	}

	.btn-edit {
		background-color: #9b59b6;
		color: white;

		&:hover {
			background-color: #8e44ad;
		}
	}

	.btn-info {
		background-color: #16a085;
		color: white;

		&:hover {
			background-color: #138d75;
		}
	}

	.btn-small {
		padding: 4px 8px;
		font-size: 0.75rem;
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

		h2 {
			margin: 0;
			font-size: 1.25rem;
			font-weight: 600;
		}
	}

	.server-count {
		font-size: 0.875rem;
		color: #2ecc71;
		background-color: rgba(46, 204, 113, 0.15);
		padding: 4px 12px;
		border-radius: 12px;
	}

	/* 빈 상태 */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		color: #7f8c8d;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 16px;
	}

	.empty-state {
		p {
			margin: 0;
			font-size: 1rem;
		}
	}

	/* 서버 목록 */
	.server-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	/* 서버 카드 */
	.server-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		background-color: #1a1a2e;
		border-radius: 8px;
		border: 1px solid #0f3460;
		transition: border-color 0.2s;

		&:hover {
			border-color: #3498db;
		}
	}

	.server-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.server-alias {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.alias-text {
		font-size: 1.125rem;
		font-weight: 600;
		color: #f39c12;
	}

	.alias-input {
		padding: 4px 8px;
		background-color: #0f3460;
		border: 1px solid #3498db;
		border-radius: 4px;
		color: #f39c12;
		font-size: 1rem;
		font-weight: 600;
		outline: none;
		width: 200px;

		&:focus {
			border-color: #f39c12;
			box-shadow: 0 0 0 2px rgba(243, 156, 18, 0.2);
		}

		&::placeholder {
			color: #7f8c8d;
			font-weight: 400;
		}
	}

	.server-id {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: #2ecc71;
	}

	.id-text {
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		color: #ecf0f1;
	}

	.server-details {
		display: flex;
		gap: 24px;
	}

	.detail-item {
		display: flex;
		gap: 8px;
		font-size: 0.75rem;
	}

	.detail-label {
		color: #7f8c8d;
	}

	.detail-value {
		color: #bdc3c7;
	}

	.server-actions {
		display: flex;
		gap: 8px;
	}
</style>
