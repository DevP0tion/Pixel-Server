import type { Socket } from 'socket.io';

/**
 * 명령어 데이터 형식 (Pixel-Collector 프로젝트와 동일)
 * Command data format: {cmd: string, args: {}}
 */
export type CommandTarget = 'unity' | 'socketIO';

export interface CommandData {
	cmd: string;
	// 명령을 전달할 대상 (미지정 시 기본 라우팅 규칙 적용)
	target?: CommandTarget;
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
 * 클라이언트 타입
 * - unity: Unity 게임 서버 클라이언트
 * - web: 웹 콘솔 클라이언트
 */
export type ClientType = 'unity' | 'web';

/**
 * 연결된 클라이언트 정보
 */
export interface ConnectedClient {
	socket: Socket;
	id: string;
	clientType: ClientType;
	authenticated: boolean;
	username?: string;
	connectedAt: Date;
}

/**
 * 명령어 핸들러 타입
 */
export type CommandHandler = (socket: Socket, args: unknown) => void;
