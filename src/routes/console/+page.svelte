<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { socketManager } from '$lib/socket';
	import { logStore, type LogType, type LogEntry } from '$lib/logStore';

	// 상태 (로그는 logStore에서 관리)
	let logs: LogEntry[] = $state(logStore.logs);
	let commandInput = $state('');
	let isConnected = $state(false);
	let isUnityConnected = $state(false);
	let logContainer: HTMLDivElement | null = $state(null);
	let autoScroll = $state(true);
	let commandTarget: 'unity' | 'svelte' | 'web' = $state('unity');
	let selectedUnityServer = $state('all'); // 'all' 또는 특정 서버 ID
	let connectedUnityServers: Array<{ id: string; name: string }> = $state([]);

	// 이벤트 리스너 정리를 위한 배열
	let eventCleanupFns: Array<() => void> = [];

	// Unity 서버 목록 (derived state)
	let unityServerOptions = $derived([{ id: 'all', name: '모든 서버' }, ...connectedUnityServers]);

	// 로그 필터 토글 상태 (기본적으로 모두 활성화)
	let filterGame = $state(true);
	let filterSocketio = $state(true);
	let filterWeb = $state(true);

	// 필터링된 로그 (derived state)
	let filteredLogs = $derived(
		logs.filter((log) => {
			if (log.type === 'game' && !filterGame) return false;
			if (log.type === 'socketio' && !filterSocketio) return false;
			if (log.type === 'web' && !filterWeb) return false;
			return true;
		})
	);

	// 로그 추가 함수
	function addLog(type: LogType, message: string) {
		logStore.addLog(type, message);
	}

	// 로그 타입별 프리픽스
	function getLogPrefix(type: LogType): string {
		switch (type) {
			case 'game':
				return '[Game]';
			case 'socketio':
				return '[SocketIO]';
			case 'web':
				return '[Web]';
			default:
				return '[Unknown]';
		}
	}

	// 명령어 전송
	function sendCommand() {
		if (!commandInput.trim()) return;

		const input = commandInput.trim();
		addLog('web', `> ${input}`);

		// 대상에 따른 처리
		if (commandTarget === 'web') {
			// 웹 콘솔 명령어 (로컬 처리)
			handleWebCommand(input);
			commandInput = '';
			return;
		}

		// 명령어 파싱
		const parts = input.split(' ');
		const cmd = parts[0];
		let args: Record<string, unknown> = {};

		// 간단한 명령어 파싱
		try {
			if (parts.length > 1) {
				const argsString = parts.slice(1).join(' ');
				// JSON 형식인 경우
				if (argsString.startsWith('{')) {
					args = JSON.parse(argsString);
				} else {
					// key=value 형식인 경우
					parts.slice(1).forEach((part) => {
						const [key, value] = part.split('=');
						if (key && value !== undefined) {
							// 숫자인 경우 변환
							args[key] = isNaN(Number(value)) ? value : Number(value);
						}
					});
				}
			}
		} catch {
			addLog('web', `명령어 파싱 오류: ${input}`);
		}

		// Socket.IO로 명령어 전송
		if (isConnected) {
			if (commandTarget === 'svelte') {
				// Svelte 서버 명령어 (svelte:command 이벤트로 전송)
				socketManager.sendSocketEvent('svelte:command', { cmd, args });
				addLog('socketio', `Svelte 서버 명령어: ${cmd}`);
			} else {
				// Unity 서버 명령어 (unity:command 이벤트로 전송)
				const targetServer = selectedUnityServer === 'all' ? undefined : selectedUnityServer;
				socketManager.sendSocketEvent('unity:command', { cmd, args, targetServer });
				const serverInfo =
					selectedUnityServer === 'all' ? '모든 Unity 서버' : `Unity 서버 (${selectedUnityServer})`;
				addLog('socketio', `${serverInfo}로 명령어 전송: ${cmd}`);
			}
		} else {
			addLog('web', '소켓 연결이 없습니다. 연결을 시도합니다...');
			reconnectSocket();
		}

		commandInput = '';
	}

	// 웹 콘솔 명령어 처리
	function handleWebCommand(input: string) {
		const parts = input.split(' ');
		const cmd = parts[0].toLowerCase();

		switch (cmd) {
			case 'help':
				addLog('web', '사용 가능한 웹 콘솔 명령어:');
				addLog('web', '  help - 도움말 표시');
				addLog('web', '  clear - 로그 지우기');
				addLog('web', '  reconnect - 소켓 재연결');
				addLog('web', '  status - 연결 상태 확인');
				break;
			case 'clear':
				clearLogs();
				break;
			case 'reconnect':
				reconnectSocket();
				break;
			case 'status':
				addLog('web', `Svelte 서버: ${isConnected ? '연결됨' : '연결 끊김'}`);
				addLog('web', `Unity 서버: ${isUnityConnected ? '연결됨' : '연결 끊김'}`);
				addLog('web', `현재 대상: ${commandTarget}`);
				break;
			default:
				addLog('web', `알 수 없는 명령어: ${cmd}. 'help'를 입력하여 도움말을 확인하세요.`);
		}
	}

	// 소켓 재연결
	function reconnectSocket() {
		addLog('web', 'Socket.IO 서버에 재연결 중...');
		socketManager.reconnect();
	}

	// 소켓 이벤트 핸들러 등록
	function setupSocketEventHandlers() {
		// 이벤트 리스너 헬퍼 함수
		function addEventHandler(event: string, handler: (...args: any[]) => void) {
			socketManager.on(event, handler);
			eventCleanupFns.push(() => socketManager.off(event, handler));
		}

		// 연결 이벤트
		addEventHandler('connect', () => {
			isConnected = true;
			addLog('socketio', `연결됨 (ID: ${socketManager.clientId})`);
		});

		// 연결 해제 이벤트
		addEventHandler('disconnect', (reason: unknown) => {
			isConnected = false;
			isUnityConnected = false;
			addLog('socketio', `연결 해제: ${reason}`);
		});

		// 연결 오류 이벤트
		addEventHandler('connect_error', (error: unknown) => {
			const err = error as Error;
			addLog('socketio', `연결 오류: ${err.message}`);
		});

		// 환영 메시지
		addEventHandler('welcome', (data: unknown) => {
			const welcomeData = data as {
				message: string;
				clientId: string;
				clientType: string;
				unityConnected: boolean;
			};
			addLog('socketio', `서버 메시지: ${welcomeData.message}`);
			addLog('socketio', `클라이언트 ID: ${welcomeData.clientId}`);
			addLog('socketio', `클라이언트 타입: ${welcomeData.clientType}`);
			isUnityConnected = welcomeData.unityConnected || false;

			if (welcomeData.unityConnected) {
				addLog('game', 'Unity 서버가 이미 연결되어 있습니다.');
			} else {
				addLog('game', 'Unity 서버가 연결되어 있지 않습니다.');
			}
		});

		// Unity 서버 연결 알림
		addEventHandler('unity:connected', (data: unknown) => {
			const unityData = data as { message: string; serverId?: string; serverName?: string };
			isUnityConnected = true;
			addLog('game', `✓ ${unityData.message}`);
			// Unity 서버가 연결되면 목록에 추가
			if (unityData.serverId && unityData.serverName) {
				if (!connectedUnityServers.find((s) => s.id === unityData.serverId)) {
					connectedUnityServers = [
						...connectedUnityServers,
						{ id: unityData.serverId, name: unityData.serverName }
					];
				}
			}
		});

		// Unity 서버 연결 해제 알림
		addEventHandler('unity:disconnected', (data: { message: string; serverId?: string }) => {
			// 특정 서버가 연결 해제된 경우
			if (data.serverId) {
				connectedUnityServers = connectedUnityServers.filter((s) => s.id !== data.serverId);
				if (selectedUnityServer === data.serverId) {
					selectedUnityServer = 'all';
				}
			}
			// 모든 Unity 서버가 연결 해제된 경우
			if (connectedUnityServers.length === 0) {
				isUnityConnected = false;
			}
			addLog('game', `✗ ${data.message}`);
		});

		// 명령어 전달 완료 응답
		addEventHandler('command:relayed', (response: unknown) => {
			const res = response as { message: string };
			addLog('socketio', `→ Unity: ${res.message}`);
		});

		// 명령어 응답 (로컬 처리)
		addEventHandler('command:response', (response: unknown) => {
			const res = response as { code: number; message: string; data?: unknown };
			const status = res.code === 100 ? '' : '✗';
			// 메시지에 \n이 포함된 경우 여러 줄로 출력
			const [firstLine, ...otherLines] = res.message.split('\n');
			addLog('socketio', `${status} ${firstLine}`);
			otherLines.forEach((line) => addLog('socketio', line));
			if (res.data) {
				addLog('socketio', `  데이터: ${JSON.stringify(res.data)}`);
			}
		});

		// Unity 서버에서 온 게임 응답
		addEventHandler('game:response', (response: unknown) => {
			const res = response as { code: number; message: string; data?: unknown };
			const status = res.code === 100 ? '✓' : '✗';
			addLog('game', `${status} ${res.message}`);
			if (res.data) {
				addLog('game', `  데이터: ${JSON.stringify(res.data)}`);
			}
		});

		// Unity 서버에서 온 게임 로그
		addEventHandler('game:log', (data: unknown) => {
			const logData = data as { message?: string };
			addLog('game', logData.message || JSON.stringify(data));
		});

		// Unity 서버에서 온 게임 이벤트
		addEventHandler('game:event', (data: unknown) => {
			const eventData = data as { type?: string; message?: string };
			addLog(
				'game',
				`이벤트: ${eventData.type || 'unknown'} - ${eventData.message || JSON.stringify(data)}`
			);
		});

		// 브로드캐스트 메시지
		addEventHandler('broadcast', (data: unknown) => {
			const broadcastData = data as { message: string; from: string };
			addLog('game', `브로드캐스트: ${broadcastData.message} (from: ${broadcastData.from})`);
		});
	}

	// 로그 지우기
	function clearLogs() {
		logStore.clearLogs();
		addLog('web', '로그가 지워졌습니다.');
	}

	// 키보드 이벤트 핸들러
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			sendCommand();
		}
	}

	// 타임스탬프 포맷
	function formatTime(date: Date): string {
		return date.toLocaleTimeString('ko-KR', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	onMount(() => {
		// logStore 이벤트 핸들러 등록
		const handleLogAdded = () => {
			logs = logStore.logs;
			// 자동 스크롤
			if (autoScroll && logContainer) {
				setTimeout(() => {
					if (logContainer) {
						logContainer.scrollTop = logContainer.scrollHeight;
					}
				}, 10);
			}
		};
		const handleLogsCleared = () => {
			logs = logStore.logs;
		};
		logStore.on('logAdded', handleLogAdded);
		logStore.on('logsCleared', handleLogsCleared);
		eventCleanupFns.push(() => {
			logStore.off('logAdded', handleLogAdded);
			logStore.off('logsCleared', handleLogsCleared);
		});

		// 처음 초기화되는 경우에만 시작 메시지 추가
		const isFirstInit = !logStore.initialized;
		if (isFirstInit) {
			logStore.initialized = true;
			addLog('web', 'Pixel Server 콘솔이 시작되었습니다.');
			addLog('web', '아키텍처: 웹 콘솔 → Svelte 서버 → Unity 서버');
			addLog(
				'web',
				'도움말: 대상을 선택하고 명령어를 입력하세요. 웹 콘솔 명령어는 "help"를 입력하세요.'
			);
		}

		// 현재 연결 상태 동기화
		isConnected = socketManager.isConnected;
		isUnityConnected = socketManager.isUnityConnected;

		// 이미 연결되어 있는 경우 메시지 표시 (처음 초기화할 때만)
		if (isConnected && isFirstInit) {
			addLog('socketio', `이미 연결됨 (ID: ${socketManager.clientId})`);
		}

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
	<title>Console - Pixel Server</title>
</svelte:head>

<div class="console-container">
	<!-- 헤더 -->
	<header class="header">
		<div class="header-left">
			<h1>Pixel Server Console</h1>
			<div class="connection-status">
				<div class="status-item">
					<span class="status-indicator" class:connected={isConnected}></span>
					<span class="status-text">Svelte: {isConnected ? '연결됨' : '연결 끊김'}</span>
				</div>
				<div class="status-item">
					<span class="status-indicator" class:connected={isUnityConnected}></span>
					<span class="status-text">Unity: {isUnityConnected ? '연결됨' : '연결 끊김'}</span>
				</div>
			</div>
		</div>
		<div class="header-right">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={autoScroll} />
				자동 스크롤
			</label>
			<button class="btn btn-secondary" onclick={clearLogs}>로그 지우기</button>
			<button class="btn btn-primary" onclick={reconnectSocket}>재연결</button>
		</div>
	</header>

	<!-- 범례 (토글 버튼) -->
	<div class="legend">
		<button
			class="toggle-btn toggle-game"
			class:active={filterGame}
			onclick={() => (filterGame = !filterGame)}
		>
			[Game] Unity 서버 (게임)
		</button>
		<button
			class="toggle-btn toggle-socketio"
			class:active={filterSocketio}
			onclick={() => (filterSocketio = !filterSocketio)}
		>
			[SocketIO] Svelte 서버 (중계)
		</button>
		<button
			class="toggle-btn toggle-web"
			class:active={filterWeb}
			onclick={() => (filterWeb = !filterWeb)}
		>
			[Web] 웹 콘솔 (입력)
		</button>
	</div>

	<!-- 로그 영역 -->
	<div bind:this={logContainer} class="log-container">
		{#each filteredLogs as log (log.id)}
			<div class="log-entry">
				<span class="log-time">{formatTime(log.timestamp)}</span>
				<span class="log-prefix log-{log.type}">{getLogPrefix(log.type)}</span>
				<span class="log-message">{log.message}</span>
			</div>
		{/each}
	</div>

	<!-- 명령어 입력 -->
	<div class="input-container">
		<div class="input-wrapper">
			<div class="target-selector">
				<select bind:value={commandTarget} class="target-dropdown">
					<option value="unity">Unity</option>
					<option value="svelte">Svelte</option>
					<option value="web">웹 콘솔</option>
				</select>
				{#if commandTarget === 'unity'}
					<select bind:value={selectedUnityServer} class="unity-server-dropdown">
						{#each unityServerOptions as server}
							<option value={server.id}>{server.name}</option>
						{/each}
					</select>
				{/if}
				<span class="prompt">$</span>
			</div>
			<input
				type="text"
				bind:value={commandInput}
				onkeydown={handleKeydown}
				placeholder={commandTarget === 'web'
					? '웹 콘솔 명령어 입력... (help, clear, status 등)'
					: commandTarget === 'svelte'
						? 'Svelte 서버 명령어 입력...'
						: 'Unity 서버 명령어 입력...'}
				class="command-input"
			/>
			<button class="btn btn-success" onclick={sendCommand}>전송</button>
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.console-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: #1a1a2e;
		color: #ffffff;
	}

	/* 헤더 */
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
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
		font-size: 1.25rem;
		font-weight: bold;
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: 6px;
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
		font-size: 0.75rem;
		color: #a0a0a0;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: #a0a0a0;
		cursor: pointer;
	}

	/* 버튼 */
	.btn {
		padding: 6px 12px;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-primary {
		background-color: #3498db;
		color: white;
	}

	.btn-primary:hover {
		background-color: #2980b9;
	}

	.btn-secondary {
		background-color: #34495e;
		color: white;
	}

	.btn-secondary:hover {
		background-color: #2c3e50;
	}

	.btn-success {
		background-color: #27ae60;
		color: white;
	}

	.btn-success:hover {
		background-color: #219a52;
	}

	/* 범례 (토글 버튼) */
	.legend {
		display: flex;
		gap: 12px;
		padding: 8px 16px;
		background-color: #16213e;
		border-bottom: 1px solid #0f3460;
		font-size: 0.875rem;
	}

	.toggle-btn {
		padding: 6px 12px;
		border: 2px solid;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition:
			background-color 0.2s,
			opacity 0.2s;
		background-color: transparent;
	}

	.toggle-game {
		color: #2ecc71;
		border-color: #2ecc71;
	}

	.toggle-game.active {
		background-color: rgba(46, 204, 113, 0.2);
	}

	.toggle-game:not(.active) {
		opacity: 0.4;
	}

	.toggle-socketio {
		color: #3498db;
		border-color: #3498db;
	}

	.toggle-socketio.active {
		background-color: rgba(52, 152, 219, 0.2);
	}

	.toggle-socketio:not(.active) {
		opacity: 0.4;
	}

	.toggle-web {
		color: #f1c40f;
		border-color: #f1c40f;
	}

	.toggle-web.active {
		background-color: rgba(241, 196, 15, 0.2);
	}

	.toggle-web:not(.active) {
		opacity: 0.4;
	}

	.toggle-btn:hover {
		filter: brightness(1.2);
	}

	/* 로그 영역 */
	.log-container {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		background-color: #1a1a2e;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
	}

	.log-entry {
		display: flex;
		margin-bottom: 4px;
		line-height: 1.5;
	}

	.log-time {
		color: #7f8c8d;
		margin-right: 8px;
		flex-shrink: 0;
	}

	.log-prefix {
		margin-right: 8px;
		flex-shrink: 0;
		font-weight: bold;
	}

	.log-game {
		color: #2ecc71;
	}

	.log-socketio {
		color: #3498db;
	}

	.log-web {
		color: #f1c40f;
	}

	.log-message {
		color: #ecf0f1;
		word-break: break-all;
	}

	/* 명령어 입력 */
	.input-container {
		padding: 16px;
		background-color: #16213e;
		border-top: 1px solid #0f3460;
	}

	.input-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.target-selector {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.target-dropdown {
		padding: 6px 12px;
		background-color: #0f3460;
		border: 1px solid #2ecc71;
		border-radius: 4px;
		color: #2ecc71;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		font-weight: bold;
		cursor: pointer;
		outline: none;
		transition: all 0.2s;
	}

	.target-dropdown:hover {
		background-color: #16213e;
		border-color: #27ae60;
	}

	.target-dropdown:focus {
		border-color: #3498db;
		box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
	}

	.target-dropdown option {
		background-color: #16213e;
		color: #ffffff;
	}

	.unity-server-dropdown {
		padding: 6px 12px;
		background-color: #0f3460;
		border: 1px solid #9b59b6;
		border-radius: 4px;
		color: #9b59b6;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		font-weight: bold;
		cursor: pointer;
		outline: none;
		transition: all 0.2s;
	}

	.unity-server-dropdown:hover {
		background-color: #16213e;
		border-color: #8e44ad;
	}

	.unity-server-dropdown:focus {
		border-color: #3498db;
		box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
	}

	.unity-server-dropdown option {
		background-color: #16213e;
		color: #ffffff;
	}

	.prompt {
		color: #2ecc71;
		font-weight: bold;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
	}

	.command-input {
		flex: 1;
		padding: 8px;
		background-color: transparent;
		border: none;
		color: #ffffff;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		outline: none;
	}

	.command-input::placeholder {
		color: #7f8c8d;
	}

	/* 스크롤바 스타일 */
	.log-container::-webkit-scrollbar {
		width: 8px;
	}

	.log-container::-webkit-scrollbar-track {
		background: #1a1a2e;
	}

	.log-container::-webkit-scrollbar-thumb {
		background: #34495e;
		border-radius: 4px;
	}

	.log-container::-webkit-scrollbar-thumb:hover {
		background: #4a6fa5;
	}
</style>
