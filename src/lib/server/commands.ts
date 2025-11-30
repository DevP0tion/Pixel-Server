import type { SocketCommandHandler } from './SocketCommandHandler.js';
import type { ConnectedClient } from './types.js';
import { createStatusHandler, handlePing } from './handlers.js';
import { translate } from './i18n/serverLocalizer.js';

/**
 * 소켓 명령어 핸들러에 기본 명령어들을 등록합니다.
 * @param commandHandler 명령어 핸들러 인스턴스
 * @param connectedClients 연결된 클라이언트 맵
 */
export function loadCommands(
	commandHandler: SocketCommandHandler,
	connectedClients: Map<string, ConnectedClient>,
) {
	// 상태 조회 명령어
	commandHandler.registerCommand('status', createStatusHandler(connectedClients));

	// Ping 명령어
	commandHandler.registerCommand('ping', handlePing);

	// 도움말 명령어
	commandHandler.registerCommand('help', (socket) => {
    const cmdInfo: { [key: string]: string } = {};
    
    for (const cmd of commandHandler.commandHandlers.keys()) {
      cmdInfo[cmd] = translate(`${cmd}`, 'No description available.');
    }
    console.log(cmdInfo)
    
		socket.emit('command:response', {
			code: 100,
			message: '사용 가능한 명령어 test\n test',
			data: cmdInfo
		});
	});

	// 서버 정보 명령어
	commandHandler.registerCommand('server:info', (socket) => {
		socket.emit('command:response', {
			code: 100,
			message: '서버 정보',
			data: {
				name: 'Pixel Server',
				version: '1.0.0',
				uptime: process.uptime(),
				memory: process.memoryUsage(),
				node: process.version
			}
		});
	});
}
