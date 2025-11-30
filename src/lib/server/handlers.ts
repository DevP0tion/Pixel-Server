import type { Socket } from 'socket.io';
import type { CommandResponse, ConnectedClient } from './types.js';

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
