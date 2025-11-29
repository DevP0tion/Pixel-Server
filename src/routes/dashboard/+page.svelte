<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { io, type Socket } from 'socket.io-client';

	// Unity 서버 정보 인터페이스
	interface UnityServerInfo {
		id: string;
		connectedAt: string;
	}

	// 상태
	let socket: Socket | null = $state(null);
	let isConnected = $state(false);
	let unityServers: UnityServerInfo[] = $state([]);

	// 소켓 연결
	function connectSocket() {
		if (socket) {
			socket.disconnect();
		}

		socket = io('http://localhost:7777', {
			transports: ['websocket', 'polling'],
			query: {
				clientType: 'web'
			}
		});

		socket.on('connect', () => {
			isConnected = true;
			// Unity 서버 목록 요청
			socket?.emit('unity:list');
		});

		socket.on('disconnect', () => {
			isConnected = false;
			unityServers = [];
		});

		// 환영 메시지에서 Unity 서버 목록 받기
		socket.on('welcome', (data) => {
			if (data.unityServers) {
				unityServers = data.unityServers;
			}
		});

		// Unity 서버 목록 응답
		socket.on('unity:list', (data) => {
			if (data.unityServers) {
				unityServers = data.unityServers;
			}
		});

		// Unity 서버 연결 알림
		socket.on('unity:connected', (data) => {
			if (data.unityServers) {
				unityServers = data.unityServers;
			}
		});

		// Unity 서버 연결 해제 알림
		socket.on('unity:disconnected', (data) => {
			if (data.unityServers) {
				unityServers = data.unityServers;
			}
		});

		// Unity 서버 강제 연결 해제 응답
		socket.on('unity:disconnect:response', (response) => {
			if (response.code === 100) {
				console.log(response.message);
			} else {
				console.error(response.message);
			}
		});
	}

	// Unity 서버 강제 연결 해제
	function disconnectUnityServer(unitySocketId: string) {
		if (socket && isConnected) {
			socket.emit('unity:disconnect', { unitySocketId });
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

	onMount(() => {
		connectSocket();
	});

	onDestroy(() => {
		if (socket) {
			socket.disconnect();
		}
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
			<button class="btn btn-primary" onclick={connectSocket}>새로고침</button>
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
									class="btn btn-danger"
									onclick={() => disconnectUnityServer(server.id)}
									title="Unity 서버 강제 연결 해제"
								>
									연결 해제
								</button>
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
	}

	.status-indicator.connected {
		background-color: #2ecc71;
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
	}

	.btn:hover {
		transform: translateY(-1px);
	}

	.btn:active {
		transform: translateY(0);
	}

	.btn-primary {
		background-color: #3498db;
		color: white;
	}

	.btn-primary:hover {
		background-color: #2980b9;
	}

	.btn-danger {
		background-color: #e74c3c;
		color: white;
	}

	.btn-danger:hover {
		background-color: #c0392b;
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

	.empty-state p {
		margin: 0;
		font-size: 1rem;
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
	}

	.server-card:hover {
		border-color: #3498db;
	}

	.server-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
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
