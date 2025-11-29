import { Server, type Socket } from 'socket.io';
import {
	type CommandData,
	type ConnectedClient,
	type ClientType,
	SocketCommandHandler,
	loadAccounts
} from '$lib/server/index.js';
import { loadCommands } from '$lib/server/commands.js';

// 연결된 클라이언트 맵
const connectedClients: Map<string, ConnectedClient> = new Map();

// Unity 서버 클라이언트들 (여러 Unity 서버 지원)
const unityServers: Map<string, Socket> = new Map();

// Unity 서버 정보를 웹 클라이언트에게 전송하기 위한 인터페이스
interface UnityServerInfo {
	id: string;
	connectedAt: string;
}

// 현재 연결된 Unity 서버 목록 가져오기
function getUnityServerList(): UnityServerInfo[] {
	const list: UnityServerInfo[] = [];
	unityServers.forEach((socket, id) => {
		const client = connectedClients.get(id);
		if (client) {
			list.push({
				id,
				connectedAt: client.connectedAt.toISOString()
			});
		}
	});
	return list;
}

// 하위 호환성을 위한 getter (첫 번째 Unity 서버 반환)
function getUnityServerSocket(): Socket | null {
	if (unityServers.size === 0) return null;
	return unityServers.values().next().value ?? null;
}

// 계정 정보 로드
const accounts = loadAccounts();

// CORS 설정
const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
	: '*';

// Socket.IO 서버 인스턴스
export const io = new Server({
	cors: {
		origin: allowedOrigins,
		methods: ['GET', 'POST']
	}
});

// 명령어 핸들러 인스턴스
export const commandHandler = new SocketCommandHandler();

// 기본 명령어 등록 (commands.ts에서 로드)
loadCommands(commandHandler, connectedClients, accounts);

/**
 * Unity 서버로 명령어를 전달하는 함수
 * @param webSocket 웹 콘솔 소켓 (응답을 받을 소켓)
 * @param data 명령어 데이터
 */
function relayCommandToUnity(webSocket: Socket, data: CommandData) {
	const unitySocket = getUnityServerSocket();
	if (unitySocket && unitySocket.connected) {
		// Unity 서버로 명령어 전달
		unitySocket.emit('command', data);

		// 웹 콘솔에 전달 완료 알림
		webSocket.emit('command:relayed', {
			code: 100,
			message: `Unity 서버로 명령어 전달됨: ${data.cmd}`,
			data: data
		});

		console.log(`[Relay] 웹 → Unity: ${data.cmd}`);
	} else {
		// Unity 서버가 연결되어 있지 않음
		webSocket.emit('command:response', {
			code: 503,
			message: 'Unity 서버가 연결되어 있지 않습니다.'
		});
		console.log(`[Relay] Unity 서버 없음 - 명령어 전달 실패: ${data.cmd}`);
	}
}

/**
 * Unity 서버에서 웹 콘솔로 응답을 전달하는 함수
 */
function relayResponseToWeb(event: string, data: unknown) {
	// 모든 웹 콘솔 클라이언트에게 응답 전달
	connectedClients.forEach((client) => {
		if (client.clientType === 'web' && client.socket.connected) {
			client.socket.emit(event, data);
		}
	});
}

// Socket.IO 연결 핸들러
io.on('connection', (socket: Socket) => {
	// 클라이언트 타입 확인 (handshake query에서)
	const clientType: ClientType = (socket.handshake.query.clientType as ClientType) || 'web';

	console.log(
		`[Connection] ${clientType === 'unity' ? 'Unity 서버' : '웹 콘솔'} 연결됨: ${socket.id}`
	);

	// 클라이언트 등록
	connectedClients.set(socket.id, {
		socket,
		id: socket.id,
		clientType,
		authenticated: false,
		connectedAt: new Date()
	});

	// 클라이언트 타입에 따라 room에 join
	if (clientType === 'unity') {
		socket.join('game');
		console.log(`[Room] Unity 서버가 'game' 채널에 참여했습니다: ${socket.id}`);
	} else {
		socket.join('web');
		console.log(`[Room] 웹 콘솔이 'web' 채널에 참여했습니다: ${socket.id}`);
	}

	// Unity 서버인 경우 저장
	if (clientType === 'unity') {
		unityServers.set(socket.id, socket);
		console.log(`[Unity] Unity 서버가 연결되었습니다. (총 ${unityServers.size}개)`);

		// 모든 웹 콘솔에 Unity 서버 연결 알림
		relayResponseToWeb('unity:connected', {
			message: 'Unity 서버가 연결되었습니다.',
			unitySocketId: socket.id,
			unityServers: getUnityServerList()
		});

		// Unity 서버에서 오는 이벤트들을 웹 콘솔로 전달
		socket.on('command:response', (data) => {
			console.log(`[Relay] Unity → 웹: command:response`);
			relayResponseToWeb('game:response', data);
		});

		socket.on('player:leave', (data) => {
			console.log(`[Relay] Unity → 웹: player:leave`);
			relayResponseToWeb('player:leave', data);
		});

		socket.on('game:log', (data) => {
			console.log(`[Relay] Unity → 웹: game:log`);
			relayResponseToWeb('game:log', data);
		});

		socket.on('game:event', (data) => {
			console.log(`[Relay] Unity → 웹: game:event`);
			relayResponseToWeb('game:event', data);
		});
	}

	// 명령어 이벤트 핸들러
	socket.on('command', (data: CommandData) => {
		const client = connectedClients.get(socket.id);

		if (client?.clientType === 'web') {
			// 웹 콘솔에서 온 명령어
			// 로컬 명령어인지 확인 (commands.ts에 정의된 명령어)
			if (isLocalCommand(data.cmd)) {
				// 스벨트 서버에서 로컬로 처리
				commandHandler.handleCommand(socket, data);
			} else {
				// Unity 서버로 전달
				relayCommandToUnity(socket, data);
			}
		} else if (client?.clientType === 'unity') {
			// Unity 서버에서 온 명령어 → 직접 처리
			commandHandler.handleCommand(socket, data);
		}
	});

	// Unity 서버 목록 요청 핸들러
	socket.on('unity:list', () => {
		socket.emit('unity:list', {
			unityServers: getUnityServerList()
		});
	});

	// Unity 서버 강제 연결 해제 요청 핸들러
	socket.on('unity:disconnect', (data: { unitySocketId: string }) => {
		const client = connectedClients.get(socket.id);

		// 웹 클라이언트만 Unity 서버 연결 해제 가능
		if (client?.clientType !== 'web') {
			socket.emit('unity:disconnect:response', {
				code: 403,
				message: '권한이 없습니다.'
			});
			return;
		}

		const unitySocket = unityServers.get(data.unitySocketId);
		if (unitySocket) {
			console.log(`[Unity] Unity 서버 강제 연결 해제: ${data.unitySocketId}`);
			unitySocket.disconnect(true);
			socket.emit('unity:disconnect:response', {
				code: 100,
				message: `Unity 서버 연결 해제됨: ${data.unitySocketId}`
			});
		} else {
			socket.emit('unity:disconnect:response', {
				code: 404,
				message: `Unity 서버를 찾을 수 없습니다: ${data.unitySocketId}`
			});
		}
	});

	// 연결 해제 핸들러
	socket.on('disconnect', () => {
		const client = connectedClients.get(socket.id);
		console.log(
			`[Disconnect] ${client?.clientType === 'unity' ? 'Unity 서버' : '웹 콘솔'} 연결 해제: ${socket.id}${client?.username ? ` (${client.username})` : ''}`
		);

		// Unity 서버가 연결 해제된 경우
		if (client?.clientType === 'unity' && unityServers.has(socket.id)) {
			unityServers.delete(socket.id);
			console.log(`[Unity] Unity 서버 연결이 해제되었습니다. (남은 서버: ${unityServers.size}개)`);

			// 모든 웹 콘솔에 Unity 서버 연결 해제 알림
			relayResponseToWeb('unity:disconnected', {
				message: 'Unity 서버 연결이 해제되었습니다.',
				unitySocketId: socket.id,
				unityServers: getUnityServerList()
			});
		}

		connectedClients.delete(socket.id);

		// 다른 클라이언트들에게 플레이어 퇴장 알림
		socket.broadcast.emit('player:leave', {
			playerId: socket.id,
			username: client?.username,
			clientType: client?.clientType
		});
	});

	// 환영 메시지 전송
	socket.emit('welcome', {
		message: 'Pixel Server에 연결되었습니다',
		clientId: socket.id,
		clientType,
		unityConnected: unityServers.size > 0,
		unityServers: getUnityServerList(),
		serverTime: new Date().toISOString()
	});
});

console.log('Starting game server on port 7777');

io.listen(7777);
