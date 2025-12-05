/**
 * 공유 소켓 관리자
 * 페이지 간 이동 시에도 소켓 연결이 유지되도록 싱글톤 패턴으로 구현
 */
import { io, type Socket } from 'socket.io-client';
import EventEmitter from 'eventemitter3';

// 소켓 상태 타입
export interface SocketState {
	isConnected: boolean;
	isUnityConnected: boolean;
	clientId: string | null;
}

// Unity 서버 정보 인터페이스
export interface UnityServerInfo {
	id: string;
	connectedAt: string;
	alias: string;
}

// 소켓 관리자 클래스
class SocketManager extends EventEmitter {
	private socket: Socket | null = null;
	private _isConnected = false;
	private _isUnityConnected = false;
	private _clientId: string | null = null;
	private _unityServers: UnityServerInfo[] = [];

	// 상태 getter
	get isConnected(): boolean {
		return this._isConnected;
	}

	get isUnityConnected(): boolean {
		return this._isUnityConnected;
	}

	get clientId(): string | null {
		return this._clientId;
	}

	get unityServers(): UnityServerInfo[] {
		return this._unityServers;
	}

	// 소켓 인스턴스 getter
	getSocket(): Socket | null {
		return this.socket;
	}

	// 연결 함수
	connect(): Socket {
		// 이미 연결되어 있거나 연결 중인 경우 기존 소켓 반환
		if (this.socket && (this.socket.connected || this.socket.active)) {
			return this.socket;
		}

		// 기존 소켓이 있으면 정리
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
		}

		// 새 소켓 연결
		this.socket = io('http://localhost:7777', {
			transports: ['websocket', 'polling'],
			query: {
				clientType: 'web'
			},
			reconnection: true,
			reconnectionAttempts: Infinity,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000
		});

		this.setupEventHandlers();
		return this.socket;
	}

	// 이벤트 핸들러 설정
	private setupEventHandlers(): void {
		if (!this.socket) return;

		// 연결 이벤트
		this.socket.on('connect', () => {
			this._isConnected = true;
			this._clientId = this.socket?.id ?? null;
			this.emit('connect');
			this.emit('stateChange', this.getState());
		});

		// 연결 해제 이벤트
		this.socket.on('disconnect', (reason) => {
			this._isConnected = false;
			this._isUnityConnected = false;
			this.emit('disconnect', reason);
			this.emit('stateChange', this.getState());
		});

		// 연결 오류 이벤트
		this.socket.on('connect_error', (error) => {
			this.emit('connect_error', error);
		});

		// 환영 메시지
		this.socket.on('welcome', (data) => {
			this._isUnityConnected = data.unityConnected || false;
			if (data.unityServers) {
				this._unityServers = data.unityServers;
			}
			this.emit('welcome', data);
			this.emit('stateChange', this.getState());
		});

		// Unity 서버 연결 알림
		this.socket.on('unity:connected', (data) => {
			this._isUnityConnected = true;
			if (data.unityServers) {
				this._unityServers = data.unityServers;
			}
			this.emit('unity:connected', data);
			this.emit('stateChange', this.getState());
		});

		// Unity 서버 연결 해제 알림
		this.socket.on('unity:disconnected', (data) => {
			if (data.unityServers) {
				this._unityServers = data.unityServers;
			}
			this._isUnityConnected = this._unityServers.length > 0;
			this.emit('unity:disconnected', data);
			this.emit('stateChange', this.getState());
		});

		// Unity 서버 목록 응답
		this.socket.on('unity:list', (data) => {
			if (data.unityServers) {
				this._unityServers = data.unityServers;
			}
			this.emit('unity:list', data);
			this.emit('stateChange', this.getState());
		});

		// Unity 서버 별칭 변경 알림
		this.socket.on('unity:alias-changed', (data) => {
			if (data.unityServers) {
				this._unityServers = data.unityServers;
			}
			this.emit('unity:alias-changed', data);
			this.emit('stateChange', this.getState());
		});

		// 기타 이벤트들 - 페이지에서 직접 구독할 수 있도록 전달
		const forwardEvents = [
			'command:relayed',
			'command:response',
			'game:response',
			'game:log',
			'game:event',
			'player:leave',
			'unity:disconnect:response',
			'unity:set-alias:response'
		];

		forwardEvents.forEach((event) => {
			this.socket?.on(event, (data) => {
				this.emit(event, data);
			});
		});
	}

	// 상태 반환
	getState(): SocketState {
		return {
			isConnected: this._isConnected,
			isUnityConnected: this._isUnityConnected,
			clientId: this._clientId
		};
	}

	// 소켓 이벤트 전송 (명시적)
	sendSocketEvent(event: string, ...args: unknown[]): boolean {
		if (this.socket && this._isConnected) {
			this.socket.emit(event, ...args);
			return true;
		}
		return false;
	}

	// 재연결
	reconnect(): Socket {
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
		}
		return this.connect();
	}

	// 연결 해제 (전체 앱이 종료될 때만 사용)
	disconnect(): void {
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
		}
		this._isConnected = false;
		this._isUnityConnected = false;
		this._clientId = null;
		this._unityServers = [];
	}
}

// 싱글톤 인스턴스
export const socketManager = new SocketManager();
