import { Server, type Socket } from 'socket.io';
import {
	type CommandData,
	type ConnectedClient,
	type ClientType,
	SocketCommandHandler,
	loadAccounts,
	createAuthHandler,
	createMoveHandler,
	createBulletHandler,
	createStatusHandler,
	handlePing
} from '$lib/server/index.js';

// 연결된 클라이언트 맵
const connectedClients: Map<string, ConnectedClient> = new Map();

// Unity 서버 클라이언트 (현재 연결된 Unity 서버)
let unityServerSocket: Socket | null = null;

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

// 기본 명령어 등록
commandHandler.registerCommand('auth', createAuthHandler(connectedClients, accounts));
commandHandler.registerCommand('move', createMoveHandler(connectedClients));
commandHandler.registerCommand('bullet', createBulletHandler(connectedClients));
commandHandler.registerCommand('status', createStatusHandler(connectedClients));
commandHandler.registerCommand('ping', handlePing);

/**
 * Unity 서버로 명령어를 전달하는 함수
 * @param webSocket 웹 콘솔 소켓 (응답을 받을 소켓)
 * @param data 명령어 데이터
 */
function relayCommandToUnity(webSocket: Socket, data: CommandData) {
	if (unityServerSocket && unityServerSocket.connected) {
		// Unity 서버로 명령어 전달
		unityServerSocket.emit('command', data);

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

	// Unity 서버인 경우 저장
	if (clientType === 'unity') {
		unityServerSocket = socket;
		console.log('[Unity] Unity 서버가 연결되었습니다.');

		// 모든 웹 콘솔에 Unity 서버 연결 알림
		relayResponseToWeb('unity:connected', {
			message: 'Unity 서버가 연결되었습니다.',
			unitySocketId: socket.id
		});

		// Unity 서버에서 오는 이벤트들을 웹 콘솔로 전달
		socket.on('command:response', (data) => {
			console.log(`[Relay] Unity → 웹: command:response`);
			relayResponseToWeb('game:response', data);
		});

		socket.on('player:move', (data) => {
			console.log(`[Relay] Unity → 웹: player:move`);
			relayResponseToWeb('player:move', data);
		});

		socket.on('bullet:spawn', (data) => {
			console.log(`[Relay] Unity → 웹: bullet:spawn`);
			relayResponseToWeb('bullet:spawn', data);
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
			// 웹 콘솔에서 온 명령어 → Unity 서버로 전달
			// 먼저 로컬 명령어(ping, status 등) 처리 시도
			if (['ping', 'status'].includes(data.cmd)) {
				// 로컬에서 처리
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

	// 연결 해제 핸들러
	socket.on('disconnect', () => {
		const client = connectedClients.get(socket.id);
		console.log(
			`[Disconnect] ${client?.clientType === 'unity' ? 'Unity 서버' : '웹 콘솔'} 연결 해제: ${socket.id}${client?.username ? ` (${client.username})` : ''}`
		);

		// Unity 서버가 연결 해제된 경우
		if (client?.clientType === 'unity' && unityServerSocket?.id === socket.id) {
			unityServerSocket = null;
			console.log('[Unity] Unity 서버 연결이 해제되었습니다.');

			// 모든 웹 콘솔에 Unity 서버 연결 해제 알림
			relayResponseToWeb('unity:disconnected', {
				message: 'Unity 서버 연결이 해제되었습니다.'
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
		unityConnected: unityServerSocket !== null && unityServerSocket.connected,
		serverTime: new Date().toISOString()
	});
});

console.log('Starting game server on port 7777');

io.listen(7777);
