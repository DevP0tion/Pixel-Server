import type { Socket } from 'socket.io';
import type { CommandData, CommandHandler, CommandResponse } from './types.js';

/**
 * 소켓 서버로부터 명령을 수신하고 처리하는 클래스입니다.
 * 명령어 데이터 형식: {cmd: string, args: {}}
 *
 * Pixel-Collector 프로젝트의 SocketCommandHandler를 참고하여 구현
 */
export class SocketCommandHandler {
	/**
	 * 명령어 핸들러 딕셔너리입니다. 키는 명령어 문자열이며, 값은 인자를 받아 실행하는 함수입니다.
	 */
	public commandHandlers: Map<string, CommandHandler> = new Map();

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
