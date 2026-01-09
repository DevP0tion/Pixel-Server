/**
 * 공유 로그 저장소
 * 페이지 간 이동 시에도 로그가 유지되도록 싱글톤 패턴으로 구현
 */
import EventEmitter from 'eventemitter3';

// 로그 타입 정의
export type LogType = 'game' | 'socketio' | 'web';

export type LogEntry = {
	id: number;
	type: LogType;
	message: string;
	timestamp: Date;
};

// 로그 저장소 클래스
class LogStore extends EventEmitter {
	private _logs: LogEntry[] = [];
	private _idCounter = 0;
	private _initialized = false;

	// 로그 목록 getter
	get logs(): LogEntry[] {
		return this._logs;
	}

	// 현재 ID 카운터 getter
	get idCounter(): number {
		return this._idCounter;
	}

	// 초기화 상태 getter
	get initialized(): boolean {
		return this._initialized;
	}

	// 초기화 상태 setter
	set initialized(value: boolean) {
		this._initialized = value;
	}

	// 로그 추가
	addLog(type: LogType, message: string): LogEntry {
		const entry: LogEntry = {
			id: this._idCounter++,
			type,
			message,
			timestamp: new Date()
		};
		this._logs = [...this._logs, entry];
		this.emit('logAdded', entry);
		return entry;
	}

	// 로그 지우기
	clearLogs(): void {
		this._logs = [];
		// ID 카운터는 초기화하지 않음 (고유 ID 보장)
		this.emit('logsCleared');
	}
}

// 싱글톤 인스턴스
export const logStore = new LogStore();
