import { Server, type Socket } from 'socket.io';
import {
	type CommandTarget,
	type ConnectedClient,
	type ClientType,
	SocketCommandHandler,
	SocketRooms
} from '$lib/server/index.js';
import { loadCommands } from '$lib/server/commands.js';
import type { CommandData } from './types';

// Unity 서버 정보를 웹 클라이언트에게 전송하기 위한 인터페이스
type UnityServerInfo = {
	id: string;
	connectedAt: string;
	alias: string;
};

export type UnityResponse = {
	code: number;
	message: string;
	data: string;
	token: string;
};

// Unity 서버 기본 별칭
const DEFAULT_UNITY_ALIAS = 'Game Server';

// CORS 설정
const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
	: '*';

// Server 객체 export (Command API에서 접근하기 위해)
export class ServerManager {
	private static instance: ServerManager | null = null;
	public unityServers: Map<string, Socket> = new Map();
	public webClients: Map<string, Socket> = new Map();
	public unityServerAliases: Map<string, string> = new Map();
	public connectedClients: Map<string, ConnectedClient> = new Map();
	public io: Server | null = null;
	private readonly commandHandler = new SocketCommandHandler();

	private constructor() {
		loadCommands(this.commandHandler, this.connectedClients);
	}

	static getInstance(): ServerManager {
		if (!ServerManager.instance) {
			ServerManager.instance = new ServerManager();
		}
		return ServerManager.instance;
	}

	/**
	 * 현재 연결된 Unity 서버 목록 가져오기
	 */
	public getUnityServerList(): UnityServerInfo[] {
		const list: UnityServerInfo[] = [];

		this.unityServers.forEach((socket, id) => {
			const client = this.connectedClients.get(id);
			if (client) {
				list.push({
					id,
					connectedAt: client.connectedAt.toISOString(),
					alias: this.unityServerAliases.get(id) || DEFAULT_UNITY_ALIAS
				});
			}
		});

		return list;
	}

	public unity(...unityServerNames: string[]) {
		const servers = Array.from(
			this.unityServers.values().filter((socket, _) => unityServerNames.includes(socket.id))
		);

		function send(cmd: string, data: any = {}) {
			servers.forEach((server) => {
				server.emit('unity:command', {
					cmd: cmd,
					data: data
				});
			});
		}

		async function fetch(
			cmd: string,
			data: any = {},
			timeout: number = 5000
		): Promise<(UnityResponse & { socket: Socket })[]> {
			const responses: (UnityResponse & { socket: Socket })[] = [];

			const fetchPromises = servers.map((server) => {
				return new Promise<void>((resolve) => {
					const token = crypto.randomUUID();
					const responseEvent = `unity:response`;
					const timeoutId = setTimeout(() => {
						server.off(responseEvent, onResponse);
						responses.push({
							code: 408,
							message: 'Request Timeout',
							data: '',
							token,
							socket: server
						});
						resolve();
					}, timeout);

					const onResponse = (res: string) => {
						const responseData = JSON.parse(res);
						if (responseData.token !== token) return;
						clearTimeout(timeoutId);
						responses.push({
							...responseData,
							socket: server
						});
						server.off(responseEvent, onResponse);
						resolve();
					};
					server.on(responseEvent, onResponse);

					server.emit('unity:command', {
						cmd,
						data,
						token
					});
				});
			});

			await Promise.all(fetchPromises);

			return responses;
		}

		return {
			send,
			fetch
		};
	}

	/**
	 * Socket.IO 서버 시작
	 */
	public start(port: number = 7777) {
		if (this.io) {
			return {
				io: this.io,
				unityServers: this.unityServers,
				webClients: this.webClients,
				unity: this.unity.bind(this),
				getUnityServerList: this.getUnityServerList.bind(this)
			};
		}

		// Socket.IO 서버 인스턴스
		const io = new Server({
			cors: {
				origin: allowedOrigins,
				methods: ['GET', 'POST']
			}
		});
		this.io = io;

		// Socket.IO 연결 핸들러
		io.on('connection', (socket: Socket) => {
			// 클라이언트 타입 확인 (handshake query에서)
			const clientType: ClientType = (socket.handshake.query.clientType as ClientType) || 'web';

			console.log(
				`[Connection] ${clientType === 'unity' ? 'Unity 서버' : '웹 콘솔'} 연결됨: ${socket.id}`
			);

			// 클라이언트 등록
			this.connectedClients.set(socket.id, {
				socket,
				id: socket.id,
				clientType,
				authenticated: false,
				connectedAt: new Date()
			});

			// 클라이언트 타입에 따라 room에 join
			if (clientType === 'unity') {
				this.unityServers.set(socket.id, socket);
				socket.join(SocketRooms.UnityServers);

				// 기본 별칭 설정
				this.unityServerAliases.set(socket.id, DEFAULT_UNITY_ALIAS);

				console.log(`[Room] Unity 서버가 'game' 채널에 참여했습니다: ${socket.id}`);
			}

			const handleUnityCommand = (commandSocket: Socket, data: CommandData) => {
				if (!data || typeof data.cmd !== 'string') {
					commandSocket.emit('command:response', {
						code: 400,
						message: '명령어 데이터가 비어있습니다.'
					});
					return;
				}

				const client = this.connectedClients.get(commandSocket.id);

				if (client?.clientType === 'unity') {
					console.log(`[Command] unity:command 수신 (Unity): ${data.cmd}`);
					// Unity 서버에서 온 명령어 → 직접 처리
					this.commandHandler.handleCommand(commandSocket, data);
				}
			};

			// Svelte 서버 명령어 이벤트 핸들러
			socket.on('svelte:command', (data: CommandData) => {
				console.log(`[Command] svelte:command 수신: ${data.cmd}`);
				// 스벨트 서버에서 로컬로 처리
				this.commandHandler.handleCommand(socket, data);
			});

			// 명령어 라우팅 이벤트 핸들러 (target에 따라 Unity 또는 SocketIO 처리)
			socket.on('unity:command', (data: CommandData) => {
				handleUnityCommand(socket, data);
			});

			// Unity 서버 목록 요청 핸들러
			socket.on('unity:list', () => {
				socket.emit('unity:list', {
					unityServers: this.getUnityServerList()
				});
			});

			// Unity 서버 별칭 변경 핸들러
			socket.on('unity:set-alias', (data: { unitySocketId: string; alias: string }) => {
				const client = this.connectedClients.get(socket.id);

				// 웹 클라이언트만 별칭 변경 가능
				if (client?.clientType !== 'web') {
					socket.emit('unity:set-alias:response', {
						code: 403,
						message: '권한이 없습니다.'
					});
					return;
				}

				if (!this.unityServers.has(data.unitySocketId)) {
					socket.emit('unity:set-alias:response', {
						code: 404,
						message: `Unity 서버를 찾을 수 없습니다: ${data.unitySocketId}`
					});
					return;
				}

				// 별칭이 비어있으면 기본값 사용
				const newAlias = data.alias?.trim() || DEFAULT_UNITY_ALIAS;
				this.unityServerAliases.set(data.unitySocketId, newAlias);
				console.log(`[Unity] Unity 서버 별칭 변경: ${data.unitySocketId} → "${newAlias}"`);

				// 응답 전송
				socket.emit('unity:set-alias:response', {
					code: 100,
					message: `별칭이 "${newAlias}"(으)로 변경되었습니다.`,
					unitySocketId: data.unitySocketId,
					alias: newAlias
				});
			});

			// Unity 서버 강제 연결 해제 요청 핸들러
			socket.on('unity:disconnect', (data: { unitySocketId: string }) => {
				const client = this.connectedClients.get(socket.id);

				// 웹 클라이언트만 Unity 서버 연결 해제 가능
				if (client?.clientType !== 'web') {
					socket.emit('unity:disconnect:response', {
						code: 403,
						message: '권한이 없습니다.'
					});
					return;
				}

				const unitySocket = this.unityServers.get(data.unitySocketId);
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
				const client = this.connectedClients.get(socket.id);
				console.log(
					`[Disconnect] ${client?.clientType === 'unity' ? 'Unity 서버' : '웹 콘솔'} 연결 해제: ${socket.id}${client?.username ? ` (${client.username})` : ''}`
				);

				// Unity 서버가 연결 해제된 경우
				if (client?.clientType === 'unity' && this.unityServers.has(socket.id)) {
					this.unityServers.delete(socket.id);
					this.unityServerAliases.delete(socket.id);
					console.log(
						`[Unity] Unity 서버 연결이 해제되었습니다. (남은 서버: ${this.unityServers.size}개)`
					);
				}

				this.connectedClients.delete(socket.id);
			});

			// 환영 메시지 전송
			socket.emit('welcome', {
				message: 'Pixel Server에 연결되었습니다',
				clientId: socket.id,
				clientType,
				unityConnected: this.unityServers.size > 0,
				unityServers: this.getUnityServerList(),
				serverTime: new Date().toISOString()
			});
		});

		console.log(`Starting game server on port ${port}`);
		io.listen(port);

		return {
			io,
			unityServers: this.unityServers,
			webClients: this.webClients,
			unity: this.unity.bind(this),
			getUnityServerList: this.getUnityServerList.bind(this)
		};
	}
}

export function startSocketServer(port: number = 7777) {
	return ServerManager.getInstance().start(port);
}
