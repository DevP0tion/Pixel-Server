import EventEmitter from 'eventemitter3';
import fs from 'fs';
import path from 'path';
import electron from 'electron';

const { BrowserWindow } = electron;

export type LogType = 'unity' | 'svelte';

export type LogEntry = {
	type: LogType;
	message: string;
	timestamp: Date;
};

type LoggerEvents = {
	log: (entry: LogEntry) => void;
};

export class Logger extends EventEmitter<LoggerEvents> {
	public logs: LogEntry[] = [];
	private logIndex: number = 0;
	private maxLogLength: number = 1000;
	private savePath: string;
	private saveBaseName: string;
	private saveIndex: number = 0;

	public constructor(savePath = '', maxLogLength = 1000) {
		super();

		// 로그 저장 경로 설정
		// production 환경이 아니면 로그를 저장하지 않음
		if (process.env.NODE_ENV !== 'production') {
			this.savePath = '';
		} else {
			this.savePath = path.resolve(process.env.root as string, savePath);
			fs.mkdirSync(this.savePath, { recursive: true });
		}

		this.maxLogLength = maxLogLength;
		this.logs = Array.from<LogEntry>({ length: maxLogLength });

		// 현재 날짜 기준으로 파일명 설정
		const date = new Date();
		const dateString = `${date.getFullYear()}-${(date.getMonth() + 1)
			.toString()
			.padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

		this.saveBaseName = `${dateString}-logs`;
	}

	public get maxLength(): number {
		return this.maxLogLength;
	}

	// 로그 추가
	public log(type: LogType, message: string): void {
		const entry: LogEntry = {
			type,
			message,
			timestamp: new Date()
		};

		// production 환경이 아니면 console.log 출력
		if (process.env.NODE_ENV !== 'production') {
			console.log(`[${entry.timestamp.toISOString()}] [${entry.type}] ${entry.message}`);
			this.logs.push(entry);
			this.emit('log', entry);
			return;
		}

		// logIndex가 maxLogLength에 도달할때까지 로그를 추가
		if (this.logIndex < this.maxLogLength) {
			this.logs[this.logIndex] = entry;
			this.logIndex++;
		} else {
			fs.mkdirSync(this.savePath, { recursive: true });
			let filePath = path.join(
				this.savePath,
				this.saveIndex === 0
					? `${this.saveBaseName}.txt`
					: `${this.saveBaseName}_${this.saveIndex}.txt`
			);
			while (fs.existsSync(filePath)) {
				this.saveIndex++;
				filePath = path.join(this.savePath, `${this.saveBaseName}_${this.saveIndex}.txt`);
			}

			// 로그를 파일에 저장
			let data = '';
			for (const entry of this.logs) {
				if (entry) {
					const log = `[${entry.timestamp.toISOString()}] [${entry.type}] ${entry.message}`;

					data += JSON.stringify(log) + '\n';
				}
			}

			fs.writeFileSync(filePath, data);
			this.saveIndex++;

			// logs 배열을 초기화 후 다시 추가
			this.logIndex = 0;
			this.logs[this.logIndex] = entry;
			this.logIndex++;
		}

		this.emit('log', entry);
		BrowserWindow.getAllWindows().forEach((win) => {
			win.webContents.send('new-log', entry);
		});
	}

	// 로그 지우기
	public clearLogs(): void {
		this.logs = [];
	}
}

export const logger = new Logger('logs');
