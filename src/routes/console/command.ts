import { logStore, type LogType } from '$lib/logStore';
import { socketManager } from '$lib/socket';

/**
 * 명령어 파싱 결과 타입
 */
export interface ParsedCommand {
	cmd: string;
	args: Record<string, unknown>;
}

/**
 * 로그 추가 함수
 */
export function addLog(type: LogType, message: string) {
	logStore.addLog(type, message);
}

/**
 * 로그 타입별 프리픽스
 */
export function getLogPrefix(type: LogType): string {
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

/**
 * 로그 지우기
 */
export function clearLogs() {
	logStore.clearLogs();
	addLog('web', '로그가 지워졌습니다.');
}

/**
 * 소켓 재연결
 */
export function reconnectSocket() {
	addLog('web', 'Socket.IO 서버에 재연결 중...');
	socketManager.reconnect();
}

/**
 * 명령어 문자열 파싱
 * @param input 명령어 문자열
 * @returns 파싱된 명령어 객체
 */
export function parseCommand(input: string): ParsedCommand {
	const parts = input.split(' ');
	const cmd = parts[0];
	let args: Record<string, unknown> = {};

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

	return { cmd, args };
}

/**
 * 웹 콘솔 명령어 처리
 * @param input 명령어 문자열
 * @param getConnectionStatus 연결 상태 조회 함수
 */
export function handleWebCommand(
	input: string,
	getConnectionStatus: () => {
		isConnected: boolean;
		isUnityConnected: boolean;
		commandTarget: string;
	}
) {
	const parts = input.split(' ');
	const cmd = parts[0].toLowerCase();
	const status = getConnectionStatus();

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
			addLog('web', `Svelte 서버: ${status.isConnected ? '연결됨' : '연결 끊김'}`);
			addLog('web', `Unity 서버: ${status.isUnityConnected ? '연결됨' : '연결 끊김'}`);
			addLog('web', `현재 대상: ${status.commandTarget}`);
			break;
		default:
			addLog('web', `알 수 없는 명령어: ${cmd}. 'help'를 입력하여 도움말을 확인하세요.`);
	}
}

/**
 * 서버로 명령어 전송
 * @param parsedCommand 파싱된 명령어
 * @param commandTarget 명령어 대상 (unity, svelte)
 * @param selectedUnityServer 선택된 Unity 서버 ID
 * @param isConnected 연결 상태
 */
export function sendToServer(
	parsedCommand: ParsedCommand,
	commandTarget: 'unity' | 'svelte',
	selectedUnityServer: string,
	isConnected: boolean
): boolean {
	if (!isConnected) {
		addLog('web', '소켓 연결이 없습니다. 연결을 시도합니다...');
		reconnectSocket();
		return false;
	}

	const { cmd, args } = parsedCommand;

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

	return true;
}
