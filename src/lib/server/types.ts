import type { Socket } from 'socket.io';

/**
 * 명령어 데이터 형식 (Pixel-Collector 프로젝트와 동일)
 * Command data format: {cmd: string, args: {}}
 */
export interface CommandData {
	cmd: string;
	args?: Record<string, unknown>;
}

/**
 * 명령어 응답 형식
 */
export interface CommandResponse {
	code: number;
	message: string;
	data?: unknown;
}

/**
 * 인증 패킷 형식 (AuthPacket)
 */
export interface AuthPacket {
	username: string;
	password: string;
}

/**
 * 인증 응답 형식 (AuthResponseMessage)
 */
export interface AuthResponseMessage {
	code: number;
	message: string;
}

/**
 * 이동 패킷 형식 (MovePacket)
 */
export interface MovePacket {
	direction: { x: number; y: number };
	canceled: boolean;
}

/**
 * 총알 패킷 형식 (BulletPacket)
 */
export interface BulletPacket {
	typeName: string;
	teamName: string;
	startPos: { x: number; y: number; z: number };
	targetPos: { x: number; y: number; z: number };
	damage: number;
}

/**
 * 연결된 클라이언트 정보
 */
export interface ConnectedClient {
	socket: Socket;
	id: string;
	authenticated: boolean;
	username?: string;
	connectedAt: Date;
}

/**
 * 명령어 핸들러 타입
 */
export type CommandHandler = (socket: Socket, args: unknown) => void;
