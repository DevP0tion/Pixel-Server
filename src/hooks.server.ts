import { Server, type Socket } from 'socket.io';

/**
 * 명령어 데이터 형식 (Pixel-Collector 프로젝트와 동일)
 * Command data format: {cmd: string, args: {}}
 */
interface CommandData {
	cmd: string;
	args?: Record<string, unknown>;
}

/**
 * 명령어 응답 형식
 */
interface CommandResponse {
	code: number;
	message: string;
	data?: unknown;
}

/**
 * 인증 패킷 형식 (AuthPacket)
 */
interface AuthPacket {
	username: string;
	password: string;
}

/**
 * 인증 응답 형식 (AuthResponseMessage)
 */
interface AuthResponseMessage {
	code: number;
	message: string;
}

/**
 * 이동 패킷 형식 (MovePacket)
 */
interface MovePacket {
	direction: { x: number; y: number };
	canceled: boolean;
}

/**
 * 총알 패킷 형식 (BulletPacket)
 */
interface BulletPacket {
	typeName: string;
	teamName: string;
	startPos: { x: number; y: number; z: number };
	targetPos: { x: number; y: number; z: number };
	damage: number;
}

/**
 * 연결된 클라이언트 정보
 */
interface ConnectedClient {
	socket: Socket;
	id: string;
	authenticated: boolean;
	username?: string;
	connectedAt: Date;
}

/**
 * 명령어 핸들러 타입
 */
type CommandHandler = (socket: Socket, args: unknown) => void;

// Type guards for packet validation
function isAuthPacket(args: unknown): args is AuthPacket {
	return (
		typeof args === 'object' &&
		args !== null &&
		'username' in args &&
		'password' in args &&
		typeof (args as AuthPacket).username === 'string' &&
		typeof (args as AuthPacket).password === 'string'
	);
}

function isMovePacket(args: unknown): args is MovePacket {
	if (typeof args !== 'object' || args === null) return false;
	const packet = args as MovePacket;
	return (
		typeof packet.direction === 'object' &&
		packet.direction !== null &&
		typeof packet.direction.x === 'number' &&
		typeof packet.direction.y === 'number' &&
		typeof packet.canceled === 'boolean'
	);
}

function isBulletPacket(args: unknown): args is BulletPacket {
	if (typeof args !== 'object' || args === null) return false;
	const packet = args as BulletPacket;
	return (
		typeof packet.typeName === 'string' &&
		typeof packet.teamName === 'string' &&
		typeof packet.damage === 'number' &&
		typeof packet.startPos === 'object' &&
		packet.startPos !== null &&
		typeof packet.startPos.x === 'number' &&
		typeof packet.startPos.y === 'number' &&
		typeof packet.startPos.z === 'number' &&
		typeof packet.targetPos === 'object' &&
		packet.targetPos !== null &&
		typeof packet.targetPos.x === 'number' &&
		typeof packet.targetPos.y === 'number' &&
		typeof packet.targetPos.z === 'number'
	);
}

/**
 * 소켓 서버로부터 명령을 수신하고 처리하는 클래스입니다.
 * 명령어 데이터 형식: {cmd: string, args: {}}
 *
 * Pixel-Collector 프로젝트의 SocketCommandHandler를 참고하여 구현
 */
class SocketCommandHandler {
	/**
	 * 명령어 핸들러 딕셔너리입니다. 키는 명령어 문자열이며, 값은 인자를 받아 실행하는 함수입니다.
	 */
	private commandHandlers: Map<string, CommandHandler> = new Map();

	/**
	 * 새로운 명령어 핸들러를 등록합니다.
	 * @param command 명령어 문자열
	 * @param handler 명령어 처리 함수
	 */
	registerCommand(command: string, handler: CommandHandler): void {
		if (!command) {
			console.warn('[SocketCommandHandler] 빈 명령어는 등록할 수 없습니다.');
			return;
		}
		this.commandHandlers.set(command, handler);
	}

	/**
	 * 등록된 명령어 핸들러를 제거합니다.
	 * @param command 제거할 명령어 문자열
	 */
	unregisterCommand(command: string): void {
		if (!command) {
			return;
		}
		this.commandHandlers.delete(command);
	}

	/**
	 * 등록된 명령어가 있는지 확인합니다.
	 * @param command 확인할 명령어 문자열
	 * @returns 등록 여부
	 */
	hasCommand(command: string): boolean {
		if (!command) {
			return false;
		}
		return this.commandHandlers.has(command);
	}

	/**
	 * 소켓 서버로부터 명령어를 수신했을 때 호출됩니다.
	 * 명령어 데이터 형식: {cmd: string, args: {}}
	 */
	handleCommand(socket: Socket, data: CommandData): void {
		try {
			if (!data) {
				console.warn('[SocketCommandHandler] 수신한 명령어 데이터가 null입니다.');
				return;
			}

			const { cmd, args } = data;
			this.executeCommand(socket, cmd, args);
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			console.error(`[SocketCommandHandler] 명령어 처리 중 오류 발생: ${error}`);
		}
	}

	/**
	 * 명령어를 직접 실행합니다.
	 * @param socket 소켓 인스턴스
	 * @param command 실행할 명령어
	 * @param args 명령어 인자
	 */
	executeCommand(socket: Socket, command: string, args: unknown): void {
		if (!command) {
			console.warn('[SocketCommandHandler] 명령어(cmd)가 비어있습니다.');
			return;
		}

		const handler = this.commandHandlers.get(command);
		if (handler) {
			handler(socket, args);
		} else {
			console.warn(`[SocketCommandHandler] 등록되지 않은 명령어입니다: ${command}`);
			socket.emit('command:response', {
				code: 404,
				message: `등록되지 않은 명령어입니다: ${command}`
			} as CommandResponse);
		}
	}

	/**
	 * 모든 명령어 핸들러를 제거합니다.
	 */
	clearCommands(): void {
		this.commandHandlers.clear();
	}
}

// 연결된 클라이언트 맵
const connectedClients: Map<string, ConnectedClient> = new Map();

// 계정 정보 - 환경변수에서 로드하거나 기본값 사용 (개발용)
// 프로덕션에서는 GAME_ACCOUNTS 환경변수를 "user1:pass1,user2:pass2" 형식으로 설정
function loadAccounts(): Map<string, string> {
	const accountsEnv = process.env.GAME_ACCOUNTS;
	if (accountsEnv) {
		const accounts = new Map<string, string>();
		accountsEnv.split(',').forEach((pair) => {
			const [username, password] = pair.split(':');
			if (username && password) {
				accounts.set(username.trim(), password.trim());
			}
		});
		if (accounts.size > 0) {
			return accounts;
		}
	}
	// 개발용 기본 계정 (프로덕션에서는 환경변수 사용 권장)
	console.warn('[Auth] GAME_ACCOUNTS 환경변수가 설정되지 않았습니다. 기본 개발 계정을 사용합니다.');
	return new Map([
		['admin', 'admin123'],
		['user', 'user123']
	]);
}

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

/**
 * 인증 핸들러 (AccountManager.OnAuthRequestMessage 참고)
 */
function handleAuth(socket: Socket, args: unknown): void {
	const client = connectedClients.get(socket.id);

	if (!client) {
		socket.emit('auth:response', {
			code: 500,
			message: 'Client not found'
		} as AuthResponseMessage);
		return;
	}

	if (!isAuthPacket(args)) {
		socket.emit('auth:response', {
			code: 400,
			message: 'Invalid credentials format'
		} as AuthResponseMessage);
		return;
	}

	const storedPassword = accounts.get(args.username);
	if (storedPassword && storedPassword === args.password) {
		client.authenticated = true;
		client.username = args.username;
		socket.emit('auth:response', {
			code: 100,
			message: 'Success'
		} as AuthResponseMessage);
		console.log(`[Auth] 인증 성공: ${args.username}`);
	} else {
		socket.emit('auth:response', {
			code: 200,
			message: 'Invalid Credentials'
		} as AuthResponseMessage);
		console.log(`[Auth] 인증 실패: ${args.username}`);
	}
}

/**
 * 이동 핸들러 (MovePacket 처리)
 */
function handleMove(socket: Socket, args: unknown): void {
	const client = connectedClients.get(socket.id);

	if (!client?.authenticated) {
		socket.emit('command:response', {
			code: 401,
			message: 'Authentication required'
		} as CommandResponse);
		return;
	}

	if (!isMovePacket(args)) {
		socket.emit('command:response', {
			code: 400,
			message: 'Invalid move packet format'
		} as CommandResponse);
		return;
	}

	// 다른 클라이언트들에게 이동 정보 브로드캐스트
	socket.broadcast.emit('player:move', {
		playerId: socket.id,
		username: client.username,
		direction: args.direction,
		canceled: args.canceled
	});

	socket.emit('command:response', {
		code: 100,
		message: 'Move processed',
		data: args
	} as CommandResponse);
}

/**
 * 총알 핸들러 (BulletPacket 처리)
 */
function handleBullet(socket: Socket, args: unknown): void {
	const client = connectedClients.get(socket.id);

	if (!client?.authenticated) {
		socket.emit('command:response', {
			code: 401,
			message: 'Authentication required'
		} as CommandResponse);
		return;
	}

	if (!isBulletPacket(args)) {
		socket.emit('command:response', {
			code: 400,
			message: 'Invalid bullet packet format'
		} as CommandResponse);
		return;
	}

	// 다른 클라이언트들에게 총알 정보 브로드캐스트
	socket.broadcast.emit('bullet:spawn', {
		shooterId: socket.id,
		username: client.username,
		typeName: args.typeName,
		teamName: args.teamName,
		startPos: args.startPos,
		targetPos: args.targetPos,
		damage: args.damage
	});

	socket.emit('command:response', {
		code: 100,
		message: 'Bullet spawned',
		data: args
	} as CommandResponse);
}

/**
 * 상태 조회 핸들러
 */
function handleStatus(socket: Socket): void {
	socket.emit('command:response', {
		code: 100,
		message: 'Status retrieved',
		data: {
			connectedClients: connectedClients.size,
			serverTime: new Date().toISOString()
		}
	} as CommandResponse);
}

/**
 * Ping 핸들러
 */
function handlePing(socket: Socket): void {
	socket.emit('command:response', {
		code: 100,
		message: 'pong',
		data: { timestamp: Date.now() }
	} as CommandResponse);
}

// 기본 명령어 등록
commandHandler.registerCommand('auth', handleAuth);
commandHandler.registerCommand('move', handleMove);
commandHandler.registerCommand('bullet', handleBullet);
commandHandler.registerCommand('status', handleStatus);
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
