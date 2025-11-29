import type { Socket } from 'socket.io';
import type { AuthResponseMessage, CommandResponse, ConnectedClient } from './types.js';
import { isAuthPacket, isMovePacket, isBulletPacket } from './validators.js';

/**
 * 계정 정보 - 환경변수에서 로드하거나 기본값 사용 (개발용)
 * 프로덕션에서는 GAME_ACCOUNTS 환경변수를 "user1:pass1,user2:pass2" 형식으로 설정
 */
export function loadAccounts(): Map<string, string> {
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

/**
 * 인증 핸들러 팩토리 (AccountManager.OnAuthRequestMessage 참고)
 */
export function createAuthHandler(
	connectedClients: Map<string, ConnectedClient>,
	accounts: Map<string, string>
) {
	return function handleAuth(socket: Socket, args: unknown): void {
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
	};
}

/**
 * 상태 조회 핸들러 팩토리
 */
export function createStatusHandler(connectedClients: Map<string, ConnectedClient>) {
	return function handleStatus(socket: Socket): void {
		socket.emit('command:response', {
			code: 100,
			message: 'Status retrieved',
			data: {
				connectedClients: connectedClients.size,
				serverTime: new Date().toISOString()
			}
		} as CommandResponse);
	};
}

/**
 * Ping 핸들러
 */
export function handlePing(socket: Socket): void {
	socket.emit('command:response', {
		code: 100,
		message: 'pong',
		data: { timestamp: Date.now() }
	} as CommandResponse);
}
