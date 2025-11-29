<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { io, type Socket } from 'socket.io-client';

	// 로그 타입 정의
	type LogType = 'game' | 'socketio' | 'web';

	interface LogEntry {
		id: number;
		type: LogType;
		message: string;
		timestamp: Date;
	}

	// 상태
	let logs: LogEntry[] = $state([]);
	let commandInput = $state('');
	let socket: Socket | null = $state(null);
	let isConnected = $state(false);
	let isUnityConnected = $state(false);
	let logIdCounter = $state(0);
	let logContainer: HTMLDivElement | null = $state(null);
	let autoScroll = $state(true);
	let commandTarget: 'unity' | 'svelte' | 'web' = $state('unity');
	let selectedUnityServer = $state('all'); // 'all' 또는 특정 서버 ID
	let connectedUnityServers: Array<{ id: string; name: string }> = $state([]);

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
		logs = [
			...logs,
			{
				id: logIdCounter++,
				type,
				message,
				timestamp: new Date()
			}
		];

		// 자동 스크롤
		if (autoScroll && logContainer) {
			setTimeout(() => {
				if (logContainer) {
					logContainer.scrollTop = logContainer.scrollHeight;
				}
			}, 10);
		}
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
		if (socket && isConnected) {
			if (commandTarget === 'svelte') {
				// Svelte 서버 명령어 (로컬 처리)
				socket.emit('command', { cmd, args });
				addLog('socketio', `Svelte 서버 명령어: ${cmd}`);
			} else {
				// Unity 서버 명령어 (전달)
				const targetServer = selectedUnityServer === 'all' ? undefined : selectedUnityServer;
				socket.emit('command', { cmd, args, targetServer });
				const serverInfo =
					selectedUnityServer === 'all' ? '모든 Unity 서버' : `Unity 서버 (${selectedUnityServer})`;
				addLog('socketio', `${serverInfo}로 명령어 전송: ${cmd}`);
			}
		} else {
			addLog('web', '소켓 연결이 없습니다. 연결을 시도합니다...');
			connectSocket();
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
				connectSocket();
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

	// 소켓 연결
	function connectSocket() {
		if (socket) {
			socket.disconnect();
		}

		addLog('web', 'Socket.IO 서버에 연결 중...');

		// 웹 콘솔로 연결 (clientType=web)
		socket = io('http://localhost:7777', {
			transports: ['websocket', 'polling'],
			query: {
				clientType: 'web'
			}
		});

		// 연결 이벤트
		socket.on('connect', () => {
			isConnected = true;
			addLog('socketio', `연결됨 (ID: ${socket?.id})`);
		});

		// 연결 해제 이벤트
		socket.on('disconnect', (reason) => {
			isConnected = false;
			isUnityConnected = false;
			addLog('socketio', `연결 해제: ${reason}`);
		});

		// 연결 오류 이벤트
		socket.on('connect_error', (error) => {
			addLog('socketio', `연결 오류: ${error.message}`);
		});

		// 환영 메시지
		socket.on('welcome', (data) => {
			addLog('socketio', `서버 메시지: ${data.message}`);
			addLog('socketio', `클라이언트 ID: ${data.clientId}`);
			addLog('socketio', `클라이언트 타입: ${data.clientType}`);
			isUnityConnected = data.unityConnected || false;

			if (data.unityConnected) {
				addLog('game', 'Unity 서버가 이미 연결되어 있습니다.');
			} else {
				addLog('game', 'Unity 서버가 연결되어 있지 않습니다.');
			}
		});

		// Unity 서버 연결 알림
		socket.on('unity:connected', (data) => {
			isUnityConnected = true;
			addLog('game', `✓ ${data.message}`);
			// Unity 서버가 연결되면 목록에 추가
			if (data.serverId && data.serverName) {
				if (!connectedUnityServers.find((s) => s.id === data.serverId)) {
					connectedUnityServers = [
						...connectedUnityServers,
						{ id: data.serverId, name: data.serverName }
					];
				}
			}
		});

		// Unity 서버 연결 해제 알림
		socket.on('unity:disconnected', (data) => {
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
		socket.on('command:relayed', (response) => {
			addLog('socketio', `→ Unity: ${response.message}`);
		});

		// 명령어 응답 (로컬 처리)
		socket.on('command:response', (response) => {
			const status = response.code === 100 ? '✓' : '✗';
			addLog('socketio', `${status} ${response.message}`);
			if (response.data) {
				addLog('socketio', `  데이터: ${JSON.stringify(response.data)}`);
			}
		});

		// Unity 서버에서 온 게임 응답
		socket.on('game:response', (response) => {
			const status = response.code === 100 ? '✓' : '✗';
			addLog('game', `${status} ${response.message}`);
			if (response.data) {
				addLog('game', `  데이터: ${JSON.stringify(response.data)}`);
			}
		});

		// Unity 서버에서 온 게임 로그
		socket.on('game:log', (data) => {
			addLog('game', data.message || JSON.stringify(data));
		});

		// Unity 서버에서 온 게임 이벤트
		socket.on('game:event', (data) => {
			addLog('game', `이벤트: ${data.type || 'unknown'} - ${data.message || JSON.stringify(data)}`);
		});

		// 인증 응답
		socket.on('auth:response', (response) => {
			const status = response.code === 100 ? '✓ 인증 성공' : '✗ 인증 실패';
			addLog('socketio', `${status}: ${response.message}`);
		});

		// 게임 이벤트: 플레이어 이동
		socket.on('player:move', (data) => {
			addLog('game', `플레이어 이동: ${data.username || data.playerId}`);
			if (data.direction) {
				addLog('game', `  방향: (${data.direction.x}, ${data.direction.y})`);
			}
		});

		// 게임 이벤트: 총알 생성
		socket.on('bullet:spawn', (data) => {
			addLog('game', `총알 생성: ${data.username || data.shooterId}`);
			addLog('game', `  타입: ${data.typeName}, 팀: ${data.teamName}`);
		});

		// 게임 이벤트: 플레이어 퇴장
		socket.on('player:leave', (data) => {
			addLog('game', `플레이어 퇴장: ${data.username || data.playerId}`);
		});

		// 브로드캐스트 메시지
		socket.on('broadcast', (data) => {
			addLog('game', `브로드캐스트: ${data.message} (from: ${data.from})`);
		});
	}

	// 로그 지우기
	function clearLogs() {
		logs = [];
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
		addLog('web', 'Pixel Server 콘솔이 시작되었습니다.');
		addLog('web', '아키텍처: 웹 콘솔 → Svelte 서버 → Unity 서버');
		addLog(
			'web',
			'도움말: 대상을 선택하고 명령어를 입력하세요. 웹 콘솔 명령어는 "help"를 입력하세요.'
		);
		connectSocket();
	});

	onDestroy(() => {
		if (socket) {
			socket.disconnect();
		}
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
			<button class="btn btn-primary" onclick={connectSocket}>재연결</button>
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
