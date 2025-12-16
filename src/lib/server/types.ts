import type { Socket } from 'socket.io';

/**
 * 명령어 데이터 형식 (Pixel-Collector 프로젝트와 동일)
 * Command data format: {cmd: string, args: {}}
 */
export type CommandTarget = 'unity' | 'socketIO';

export type CommandData = {
	cmd: string;
	// 명령을 전달할 대상 (미지정 시 기본 라우팅 규칙 적용)
	args: Record<string, unknown>;
} & ({ 
		target: "unity"
		targetServer: string[];
	} | {
		target: "socketIO"
	} | {
		target?: undefined
	}
)

/**
 * 명령어 응답 형식
 */
export type CommandResponse = {
	code: number;
	message: string;
	data?: unknown;
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
export type ConnectedClient = {
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
