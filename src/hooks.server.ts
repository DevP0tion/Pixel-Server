import { Server, type Socket } from 'socket.io';
import {
	type CommandData,
	type ConnectedClient,
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

// Socket.IO 연결 핸들러
io.on('connection', (socket: Socket) => {
	console.log(`[Connection] 게임 서버 연결됨: ${socket.id}`);

	// 클라이언트 등록
	connectedClients.set(socket.id, {
		socket,
		id: socket.id,
		authenticated: false,
		connectedAt: new Date()
	});

	// 명령어 이벤트 핸들러
	// 명령어 데이터 형식: {cmd: string, args: {}}
	socket.on('command', (data: CommandData) => {
		commandHandler.handleCommand(socket, data);
	});

	// 연결 해제 핸들러
	socket.on('disconnect', () => {
		const client = connectedClients.get(socket.id);
		console.log(
			`[Disconnect] 게임 서버 연결 해제: ${socket.id}${client?.username ? ` (${client.username})` : ''}`
		);
		connectedClients.delete(socket.id);

		// 다른 클라이언트들에게 플레이어 퇴장 알림
		socket.broadcast.emit('player:leave', {
			playerId: socket.id,
			username: client?.username
		});
	});

	// 환영 메시지 전송
	socket.emit('welcome', {
		message: 'Pixel Server에 연결되었습니다',
		clientId: socket.id,
		serverTime: new Date().toISOString()
	});
});

console.log('Starting game server on port 7777');

io.listen(7777);
