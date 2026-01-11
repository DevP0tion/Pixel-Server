import EventEmitter from 'eventemitter3';
import type { LogEntry, LogType } from '../server/logger';

type LogStoreEvents = {
	logAdded: (entry: LogEntry) => void;
	logsCleared: () => void;
};

class LogStore extends EventEmitter<LogStoreEvents> {
	public logs: LogEntry[] = [];
	public initialized = false;
	private counter = 0;

	public addLog(type: LogType, message: string) {
		const entry: LogEntry = {
			type,
			message,
			timestamp: new Date()
		};

		this.logs = [...this.logs, entry];
		this.emit('logAdded', entry);
	}

	public clearLogs() {
		this.logs = [];
		this.emit('logsCleared');
	}
}

export const logStore = new LogStore();
