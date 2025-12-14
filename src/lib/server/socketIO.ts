import { Server, type Socket } from 'socket.io';
import {
	type CommandData,
	type CommandTarget,
	type ConnectedClient,
	type ClientType,
	SocketCommandHandler,
	SocketRooms
} from '$lib/server/index.js';
import { loadCommands } from '$lib/server/commands.js';

// Unity 서버 정보를 웹 클라이언트에게 전송하기 위한 인터페이스
interface UnityServerInfo {
	id: string;
	connectedAt: string;
	alias: string;
}

export interface UnityResponsePayload {
	code: number;
	message: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: any;
}

/**
 * Unity 서버로 전송하는 명령어 데이터 형식
 * Unity에서 수신하는 형식: {cmd: string, data: any}
 */
interface UnityCommandPayload {
	cmd: string;
	data: Record<string, unknown>;
}

interface WebToUnityPayload {
	cmd: string;
	data: CommandData;
}

/**
 * 현재 연결된 Unity 서버 목록 가져오기
 */
function getUnityServerList(
	unityServers: Map<string, Socket>,
	connectedClients: Map<string, ConnectedClient>,
	unityServerAliases: Map<string, string>,
	DEFAULT_UNITY_ALIAS: string
): UnityServerInfo[] {
	const list: UnityServerInfo[] = [];
	unityServers.forEach((socket, id) => {
		const client = connectedClients.get(id);
		if (client) {
			list.push({
				id,
				connectedAt: client.connectedAt.toISOString(),
				alias: unityServerAliases.get(id) || DEFAULT_UNITY_ALIAS
			});
		}
	});
	return list;
}

/**
 * CommandData를 Unity 명령어 페이로드로 변환
 * @param data 원본 CommandData
 * @returns Unity 서버용 명령어 페이로드
 */
function formatUnityPayload(data: CommandData): UnityCommandPayload {
	// args에서 targetUnityId 제거 후 data로 변환
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { targetUnityId: _targetUnityId, ...restArgs } = data.args ?? {};

	return {
		cmd: data.cmd,
		data: restArgs
	};
}

/**
 * Unity 서버 선택 및 이벤트 전송 헬퍼 함수
 * @param webSocket 웹 콘솔 소켓
 * @param eventName 전송할 이벤트 이름
 * @param targetUnityId 특정 Unity 서버 ID (선택)
 * @param payload 전송할 데이터
 * @param unityServers Unity 서버 맵
 * @param errorEmptyDataKey 데이터가 없을 때 응답에 포함할 키
 */
function relayToUnityServer(
	webSocket: Socket,
	eventName: string,
	targetUnityId: string | undefined,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	payload: any,
	unityServers: Map<string, Socket>,
	errorEmptyDataKey: string
) {
	if (targetUnityId) {
		// 특정 Unity 서버에 요청
		const unitySocket = unityServers.get(targetUnityId);
		if (!unitySocket || !unitySocket.connected) {
			webSocket.emit(eventName, {
				code: 404,
				message: `Unity 서버를 찾을 수 없습니다: ${targetUnityId}`,
				[errorEmptyDataKey]: []
			});
			return;
		}
		unitySocket.emit(eventName, payload);
	} else if (unityServers.size > 0) {
		// 첫 번째 Unity 서버에 요청
		const firstUnitySocket = Array.from(unityServers.values())[0];
		if (firstUnitySocket && firstUnitySocket.connected) {
			firstUnitySocket.emit(eventName, payload);
		} else {
			webSocket.emit(eventName, {
				code: 503,
				message: 'Unity 서버가 연결되어 있지 않습니다.',
				[errorEmptyDataKey]: []
			});
		}
	} else {
		webSocket.emit(eventName, {
			code: 503,
			message: 'Unity 서버가 연결되어 있지 않습니다.',
			[errorEmptyDataKey]: []
		});
	}
}

/**
 * Unity 서버로 명령어를 전달하는 함수
 * @param webSocket 웹 콘솔 소켓 (응답을 받을 소켓)
 * @param data 명령어 데이터 (args.targetUnityId로 특정 Unity 서버 지정, 없으면 모든 서버로 전송)
 */
function relayCommandToUnity(
	webSocket: Socket,
	data: CommandData,
	unityServers: Map<string, Socket>
) {
	const targetUnityId = data.args?.targetUnityId as string | undefined;
	const unityPayload = formatUnityPayload(data);

	if (targetUnityId) {
		// 특정 Unity 서버 ID가 지정된 경우
		const unitySocket = unityServers.get(targetUnityId);
		if (!unitySocket) {
			webSocket.emit('command:response', {
				code: 404,
				message: `지정된 Unity 서버를 찾을 수 없습니다: ${targetUnityId}`
			});
			console.log(
				`[Relay] 지정된 Unity 서버 없음 - 명령어 전달 실패: ${data.cmd} (대상: ${targetUnityId})`
			);
			return;
		}

		if (unitySocket.connected) {
			unitySocket.emit('unity:command', unityPayload);
			webSocket.emit('command:relayed', {
				code: 100,
				message: `Unity 서버로 명령어 전달됨: ${data.cmd}`,
				targetUnityIds: [unitySocket.id],
				data: unityPayload
			});
			console.log(`[Relay] 웹 → Unity(${unitySocket.id}): ${data.cmd}`);
		} else {
			webSocket.emit('command:response', {
				code: 503,
				message: `Unity 서버가 연결되어 있지 않습니다: ${targetUnityId}`
			});
			console.log(`[Relay] Unity 서버 연결 끊김 - 명령어 전달 실패: ${data.cmd}`);
		}
	} else {
		// targetUnityId가 없으면 모든 Unity 서버로 브로드캐스트
		if (unityServers.size === 0) {
			webSocket.emit('command:response', {
				code: 503,
				message: 'Unity 서버가 연결되어 있지 않습니다.'
			});
			console.log(`[Relay] Unity 서버 없음 - 명령어 전달 실패: ${data.cmd}`);
			return;
		}

		const sentTo: string[] = [];
		unityServers.forEach((unitySocket, id) => {
			if (unitySocket.connected) {
				unitySocket.emit('unity:command', unityPayload);
				sentTo.push(id);
			}
		});

		if (sentTo.length > 0) {
			webSocket.emit('command:relayed', {
				code: 100,
				message: `${sentTo.length}개의 Unity 서버로 명령어 전달됨: ${data.cmd}`,
				targetUnityIds: sentTo,
				data: unityPayload
			});
			console.log(`[Relay] 웹 → Unity(${sentTo.join(', ')}): ${data.cmd}`);
		} else {
			webSocket.emit('command:response', {
				code: 503,
				message: '연결된 Unity 서버가 모두 응답하지 않습니다.'
			});
			console.log(`[Relay] 모든 Unity 서버 연결 끊김 - 명령어 전달 실패: ${data.cmd}`);
		}
	}
}

/**
 * Unity 서버에서 웹 콘솔로 응답을 전달하는 함수
 */
function relayResponseToWeb(
	event: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: any,
	connectedClients: Map<string, ConnectedClient>
) {
	// 모든 웹 콘솔 클라이언트에게 응답 전달
	connectedClients.forEach((client) => {
		if (client.clientType === 'web' && client.socket.connected) {
			client.socket.emit(event, data);
		}
	});
}

/**
 * 명령어 타겟 결정 (기본값: 웹 → Unity, Unity → SocketIO)
 */
function resolveCommandTarget(data: CommandData, clientType?: ClientType): CommandTarget {
	if (data.target === 'unity' || data.target === 'socketIO') {
		return data.target;
	}

	return clientType === 'unity' ? 'socketIO' : 'unity';
}

/**
 * Socket.IO 서버 시작
 */
export function startSocketServer(port: number = 7777) {
	// 연결된 클라이언트 맵
	const connectedClients: Map<string, ConnectedClient> = new Map();

	// Unity 서버 클라이언트들 (여러 Unity 서버 지원)
	const unityServers: Map<string, Socket> = new Map();

	// Unity 서버 별칭 저장소
	const unityServerAliases: Map<string, string> = new Map();

	// Unity 서버 기본 별칭
	const DEFAULT_UNITY_ALIAS = 'Game Server';

	// CORS 설정
	const allowedOrigins = process.env.ALLOWED_ORIGINS
		? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
		: '*';

	// Socket.IO 서버 인스턴스
	const io = new Server({
		cors: {
			origin: allowedOrigins,
			methods: ['GET', 'POST']
		}
	});

	// 명령어 핸들러 인스턴스
	const commandHandler = new SocketCommandHandler();

	// 기본 명령어 등록 (commands.ts에서 로드)
	loadCommands(commandHandler, connectedClients);

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
			socket.join(SocketRooms.UnityServers);
			console.log(`[Room] Unity 서버가 'game' 채널에 참여했습니다: ${socket.id}`);
		} else {
			socket.join(SocketRooms.WebClients);
			console.log(`[Room] 웹 콘솔이 'web' 채널에 참여했습니다: ${socket.id}`);
		}

		// Unity 서버인 경우 저장
		if (clientType === 'unity') {
			unityServers.set(socket.id, socket);
			// 기본 별칭 설정
			unityServerAliases.set(socket.id, DEFAULT_UNITY_ALIAS);

			// 모든 웹 콘솔에 Unity 서버 연결 알림
			relayResponseToWeb(
				'unity:connected',
				{
					message: 'Unity 서버가 연결되었습니다.',
					unitySocketId: socket.id,
					unityServers: getUnityServerList(
						unityServers,
						connectedClients,
						unityServerAliases,
						DEFAULT_UNITY_ALIAS
					)
				},
				connectedClients
			);

			// Unity 서버에서 오는 이벤트들을 웹 콘솔로 전달
			socket.on('command:response', (data: UnityResponsePayload) => {
				console.log(`[Relay] Unity → 웹: command:response`);
				relayResponseToWeb('game:response', data, connectedClients);
			});

			socket.on('player:leave', (data) => {
				console.log(`[Relay] Unity → 웹: player:leave`);
				relayResponseToWeb('player:leave', data, connectedClients);
			});

			socket.on('game:log', (data) => {
				console.log(`[Relay] Unity → 웹: game:log`);
				relayResponseToWeb('game:log', data, connectedClients);
			});

			socket.on('game:event', (data) => {
				console.log(`[Relay] Unity → 웹: game:event`);
				relayResponseToWeb('game:event', data, connectedClients);
			});

			socket.on('zones:list', (data) => {
				console.log(`[Relay] Unity → 웹: zones:list`);
				relayResponseToWeb('zones:list', data, connectedClients);
			});
		}

		const handleUnityCommand = (commandSocket: Socket, data: CommandData | undefined) => {
			if (!data || typeof data.cmd !== 'string') {
				commandSocket.emit('command:response', {
					code: 400,
					message: '명령어 데이터가 비어있습니다.'
				});
				return;
			}

			const client = connectedClients.get(commandSocket.id);
			const target = resolveCommandTarget(data, client?.clientType);

			if (client?.clientType === 'web') {
				if (target === 'unity') {
					console.log(`[Command] unity:command 수신 (웹 → Unity): ${data.cmd}`);
					// 웹 콘솔에서 온 명령어 → Unity 서버로 전달
					relayCommandToUnity(commandSocket, data, unityServers);
					return;
				}

				if (target === 'socketIO') {
					console.log(`[Command] unity:command 수신 (웹 → SocketIO): ${data.cmd}`);
					// SocketIO 서버에서 처리
					commandHandler.handleCommand(commandSocket, data);
					return;
				}

				commandSocket.emit('command:response', {
					code: 400,
					message: `지원하지 않는 명령 대상입니다: ${String(data.target)}`
				});
				return;
			}

			if (client?.clientType === 'unity') {
				console.log(`[Command] unity:command 수신 (Unity): ${data.cmd}`);
				// Unity 서버에서 온 명령어 → 직접 처리
				commandHandler.handleCommand(commandSocket, data);
			}
		};

		// Svelte 서버 명령어 이벤트 핸들러
		socket.on('svelte:command', (data: CommandData) => {
			console.log(`[Command] svelte:command 수신: ${data.cmd}`);
			// 스벨트 서버에서 로컬로 처리
			commandHandler.handleCommand(socket, data);
		});

		// 명령어 라우팅 이벤트 핸들러 (target에 따라 Unity 또는 SocketIO 처리)
		socket.on('unity:command', (data: CommandData) => {
			handleUnityCommand(socket, data);
		});

		// 웹 콘솔 → Unity 라우팅 통합 핸들러
		socket.on('webToUnity', (payload: WebToUnityPayload) => {
			const client = connectedClients.get(socket.id);
			if (client?.clientType !== 'web') {
				socket.emit('command:response', {
					code: 403,
					message: 'webToUnity 이벤트는 웹 콘솔만 사용할 수 있습니다.'
				});
				return;
			}

			if (!payload || typeof payload.cmd !== 'string') {
				socket.emit('command:response', {
					code: 400,
					message: 'webToUnity 이벤트에는 cmd가 필요합니다.'
				});
				return;
			}

			const { cmd, data } = payload;

			if (cmd === 'unity:command') {
				handleUnityCommand(socket, data as CommandData);
				return;
			}

			if (cmd === 'zones:list') {
				const targetUnityId = (data as { targetUnityId?: string } | undefined)?.targetUnityId;
				console.log(`[Command] webToUnity 수신 (zones:list)`);
				relayToUnityServer(socket, 'zones:list', targetUnityId, {}, unityServers, 'zones');
				return;
			}

			socket.emit('command:response', {
				code: 404,
				message: `지원하지 않는 webToUnity cmd 입니다: ${cmd}`
			});
		});

		// Unity 서버 목록 요청 핸들러
		socket.on('unity:list', () => {
			socket.emit('unity:list', {
				unityServers: getUnityServerList(
					unityServers,
					connectedClients,
					unityServerAliases,
					DEFAULT_UNITY_ALIAS
				)
			});
		});

		// Zones 목록 요청 핸들러
		socket.on('zones:list', (data: { targetUnityId?: string } = {}) => {
			relayToUnityServer(socket, 'zones:list', data.targetUnityId, {}, unityServers, 'zones');
		});

		// Unity 서버 별칭 변경 핸들러
		socket.on('unity:set-alias', (data: { unitySocketId: string; alias: string }) => {
			const client = connectedClients.get(socket.id);

			// 웹 클라이언트만 별칭 변경 가능
			if (client?.clientType !== 'web') {
				socket.emit('unity:set-alias:response', {
					code: 403,
					message: '권한이 없습니다.'
				});
				return;
			}

			if (!unityServers.has(data.unitySocketId)) {
				socket.emit('unity:set-alias:response', {
					code: 404,
					message: `Unity 서버를 찾을 수 없습니다: ${data.unitySocketId}`
				});
				return;
			}

			// 별칭이 비어있으면 기본값 사용
			const newAlias = data.alias?.trim() || DEFAULT_UNITY_ALIAS;
			unityServerAliases.set(data.unitySocketId, newAlias);
			console.log(`[Unity] Unity 서버 별칭 변경: ${data.unitySocketId} → "${newAlias}"`);

			// 응답 전송
			socket.emit('unity:set-alias:response', {
				code: 100,
				message: `별칭이 "${newAlias}"(으)로 변경되었습니다.`,
				unitySocketId: data.unitySocketId,
				alias: newAlias
			});

			// 모든 웹 클라이언트에 별칭 변경 알림
			relayResponseToWeb(
				'unity:alias-changed',
				{
					unitySocketId: data.unitySocketId,
					alias: newAlias,
					unityServers: getUnityServerList(
						unityServers,
						connectedClients,
						unityServerAliases,
						DEFAULT_UNITY_ALIAS
					)
				},
				connectedClients
			);
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
				unityServerAliases.delete(socket.id);
				console.log(
					`[Unity] Unity 서버 연결이 해제되었습니다. (남은 서버: ${unityServers.size}개)`
				);

				// 모든 웹 콘솔에 Unity 서버 연결 해제 알림
				relayResponseToWeb(
					'unity:disconnected',
					{
						message: 'Unity 서버 연결이 해제되었습니다.',
						unitySocketId: socket.id,
						unityServers: getUnityServerList(
							unityServers,
							connectedClients,
							unityServerAliases,
							DEFAULT_UNITY_ALIAS
						)
					},
					connectedClients
				);
			}

			connectedClients.delete(socket.id);
		});

		// 환영 메시지 전송
		socket.emit('welcome', {
			message: 'Pixel Server에 연결되었습니다',
			clientId: socket.id,
			clientType,
			unityConnected: unityServers.size > 0,
			unityServers: getUnityServerList(
				unityServers,
				connectedClients,
				unityServerAliases,
				DEFAULT_UNITY_ALIAS
			),
			serverTime: new Date().toISOString()
		});
	});

	console.log(`Starting game server on port ${port}`);
	io.listen(port);

	return {io, unityServers};
}
