# Socket.IO API 문서

Pixel Server의 Socket.IO 통신 API에 대한 상세 문서입니다.

## 목차

1. [개요](#개요)
2. [서버 구조](#서버-구조)
3. [연결 방법](#연결-방법)
4. [클라이언트 타입](#클라이언트-타입)
5. [이벤트 목록](#이벤트-목록)
   - [서버 → 클라이언트](#서버--클라이언트)
   - [클라이언트 → 서버](#클라이언트--서버)
6. [명령어 시스템](#명령어-시스템)
7. [데이터 타입](#데이터-타입)
8. [응답 코드](#응답-코드)
9. [사용 예제](#사용-예제)

---

## 개요

Pixel Server는 Socket.IO를 사용하여 실시간 양방향 통신을 지원합니다. 이 서버는 웹 콘솔 클라이언트와 Unity 게임 서버 간의 중계 역할을 수행하며, 포트 **7777**에서 실행됩니다.

### 주요 기능

- **웹 콘솔 ↔ Unity 서버 통신 중계**
- **다중 Unity 서버 지원**
- **명령어 기반 통신 시스템**
- **실시간 이벤트 브로드캐스트**

---

## 서버 구조

```
┌─────────────────┐     ┌─────────────────┐
│   웹 콘솔        │     │   Unity 서버     │
│   (클라이언트)   │     │   (클라이언트)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    Socket.IO 연결      │
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│           Pixel Server (포트: 7777)      │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ 명령어 핸들러 │  │ 이벤트 릴레이    │  │
│  └─────────────┘  └──────────────────┘  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      클라이언트 관리 시스템       │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## 연결 방법

### 웹 클라이언트 연결

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:7777', {
	transports: ['websocket', 'polling'],
	query: {
		clientType: 'web'
	},
	reconnection: true,
	reconnectionAttempts: Infinity,
	reconnectionDelay: 1000,
	reconnectionDelayMax: 5000
});
```

### Unity 클라이언트 연결

Unity 클라이언트는 연결 시 `clientType`을 `'unity'`로 설정해야 합니다:

```
쿼리 파라미터: clientType=unity
```

### CORS 설정

서버는 환경 변수 `ALLOWED_ORIGINS`를 통해 CORS를 설정합니다:

```bash
# 예시
ALLOWED_ORIGINS=http://localhost:3000,http://example.com
```

설정되지 않은 경우 모든 origin을 허용합니다(`'*'`).

---

## 클라이언트 타입

| 타입    | 설명               | Room   |
| ------- | ------------------ | ------ |
| `web`   | 웹 콘솔 클라이언트 | `web`  |
| `unity` | Unity 게임 서버    | `game` |

### 클라이언트 정보 인터페이스

```typescript
interface ConnectedClient {
	socket: Socket; // 소켓 인스턴스
	id: string; // 소켓 ID
	clientType: ClientType; // 'unity' 또는 'web'
	authenticated: boolean; // 인증 여부
	username?: string; // 사용자명 (선택)
	connectedAt: Date; // 연결 시간
}
```

---

## 이벤트 목록

### 서버 → 클라이언트

#### `welcome`

클라이언트 연결 시 전송되는 환영 메시지입니다.

```typescript
// 페이로드
{
  message: string;           // 환영 메시지
  clientId: string;          // 할당된 클라이언트 ID
  clientType: ClientType;    // 클라이언트 타입
  unityConnected: boolean;   // Unity 서버 연결 상태
  unityServers: UnityServerInfo[]; // 연결된 Unity 서버 목록
  serverTime: string;        // 서버 시간 (ISO 8601)
}
```

#### `unity:connected`

Unity 서버가 연결되었을 때 모든 웹 클라이언트에 전송됩니다.

```typescript
// 페이로드
{
  message: string;                 // 연결 메시지
  unitySocketId: string;           // 연결된 Unity 서버 소켓 ID
  unityServers: UnityServerInfo[]; // 전체 Unity 서버 목록
}
```

#### `unity:disconnected`

Unity 서버 연결이 해제되었을 때 모든 웹 클라이언트에 전송됩니다.

```typescript
// 페이로드
{
  message: string;                 // 연결 해제 메시지
  unitySocketId: string;           // 해제된 Unity 서버 소켓 ID
  unityServers: UnityServerInfo[]; // 남은 Unity 서버 목록
}
```

#### `unity:list`

Unity 서버 목록 요청에 대한 응답입니다.

```typescript
// 페이로드
{
  unityServers: UnityServerInfo[]; // Unity 서버 목록
}
```

#### `unity:disconnect:response`

Unity 서버 강제 연결 해제 요청에 대한 응답입니다.

```typescript
// 페이로드
{
	code: number; // 응답 코드 (100: 성공, 403: 권한 없음, 404: 서버 없음)
	message: string; // 응답 메시지
}
```

#### `unity:set-alias:response`

Unity 서버 별칭 변경 요청에 대한 응답입니다.

```typescript
// 페이로드
{
	code: number;          // 응답 코드 (100: 성공, 403: 권한 없음, 404: 서버 없음)
	message: string;       // 응답 메시지
	unitySocketId?: string; // 변경된 Unity 서버 ID (성공 시)
	alias?: string;        // 변경된 별칭 (성공 시)
}
```

#### `unity:alias-changed`

Unity 서버 별칭이 변경되었을 때 모든 웹 클라이언트에 전송됩니다.

```typescript
// 페이로드
{
	unitySocketId: string;           // 별칭이 변경된 Unity 서버 ID
	alias: string;                   // 새 별칭
	unityServers: UnityServerInfo[]; // 전체 Unity 서버 목록
}
```

#### `command:response`

명령어 실행 결과를 전송합니다.

```typescript
// 페이로드
{
  code: number;    // 응답 코드
  message: string; // 응답 메시지
  data?: unknown;  // 추가 데이터 (선택)
}
```

#### `command:relayed`

명령어가 Unity 서버로 전달되었음을 알립니다.

```typescript
// 페이로드
{
  code: number;            // 응답 코드 (100: 성공)
  message: string;         // 전달 메시지
  targetUnityIds: string[]; // 전달된 Unity 서버 ID 목록
  data: {                  // Unity에 전송된 데이터
    cmd: string;
    data: Record<string, unknown>;
  }
}
```

#### `game:response`

Unity 서버에서 온 명령어 응답을 웹 클라이언트에 전달합니다.

```typescript
// 페이로드 - Unity 서버에서 정의한 형식
```

#### `game:log`

Unity 서버에서 온 로그 메시지를 전달합니다.

```typescript
// 페이로드 - Unity 서버에서 정의한 형식
```

#### `game:event`

Unity 서버에서 발생한 게임 이벤트를 전달합니다.

```typescript
// 페이로드 - Unity 서버에서 정의한 형식
```

#### `player:leave`

플레이어가 게임을 떠났을 때 전달됩니다.

```typescript
// 페이로드 - Unity 서버에서 정의한 형식
```

---

### 클라이언트 → 서버

#### `svelte:command`

Svelte 서버에서 직접 처리할 명령어를 전송합니다.

```typescript
// 페이로드
{
  cmd: string;                    // 명령어 이름
  args?: Record<string, unknown>; // 명령어 인자 (선택)
}
```

#### `unity:command`

Unity 서버로 전달할 명령어를 전송합니다.

**웹 클라이언트가 전송하는 경우:** Unity 서버로 릴레이됩니다.

```typescript
// 페이로드
{
  cmd: string;                    // 명령어 이름
  args?: {
    targetUnityId?: string;       // 특정 Unity 서버 ID (선택, 없으면 전체 브로드캐스트)
    [key: string]: unknown;       // 기타 인자
  }
}
```

**Unity 클라이언트가 전송하는 경우:** 서버에서 직접 처리됩니다.

#### `unity:list`

연결된 Unity 서버 목록을 요청합니다.

```typescript
// 페이로드 없음
```

#### `unity:disconnect`

특정 Unity 서버의 연결을 강제로 해제합니다. (웹 클라이언트만 가능)

```typescript
// 페이로드
{
	unitySocketId: string; // 연결 해제할 Unity 서버 ID
}
```

#### `unity:set-alias`

Unity 서버의 별칭을 변경합니다. (웹 클라이언트만 가능)

```typescript
// 페이로드
{
	unitySocketId: string; // 별칭을 변경할 Unity 서버 ID
	alias: string;         // 새 별칭 (빈 문자열이면 'Game Server'로 설정)
}
```

**응답 이벤트:**

- `unity:set-alias:response`: 요청한 클라이언트에게 응답
- `unity:alias-changed`: 모든 웹 클라이언트에게 변경 알림

---

## 명령어 시스템

### 등록된 명령어

| 명령어        | 설명                       | 응답 이벤트        |
| ------------- | -------------------------- | ------------------ |
| `ping`        | 서버 연결 확인 (pong 응답) | `command:response` |
| `status`      | 서버 상태 조회             | `command:response` |
| `help`        | 사용 가능한 명령어 목록    | `command:response` |
| `server:info` | 서버 상세 정보 조회        | `command:response` |

### 명령어 데이터 형식

```typescript
interface CommandData {
	cmd: string; // 명령어 이름
	args?: Record<string, unknown>; // 명령어 인자
}
```

### 명령어 응답 형식

```typescript
interface CommandResponse {
	code: number; // 응답 코드
	message: string; // 응답 메시지
	data?: unknown; // 추가 데이터 (선택)
}
```

### 명령어 실행 예제

```typescript
// ping 명령어
socket.emit('svelte:command', { cmd: 'ping' });

// 결과 수신
socket.on('command:response', (response) => {
	console.log(response);
	// { code: 100, message: 'pong', data: { timestamp: 1234567890 } }
});
```

---

## 데이터 타입

### UnityServerInfo

```typescript
interface UnityServerInfo {
	id: string; // Unity 서버 소켓 ID
	connectedAt: string; // 연결 시간 (ISO 8601)
	alias: string; // 서버 별칭 (기본값: 'Game Server')
}
```

### ClientType

```typescript
type ClientType = 'unity' | 'web';
```

### AuthPacket

```typescript
interface AuthPacket {
	username: string;
	password: string;
}
```

### AuthResponseMessage

```typescript
interface AuthResponseMessage {
	code: number;
	message: string;
}
```

### MovePacket

```typescript
interface MovePacket {
	direction: { x: number; y: number };
	canceled: boolean;
}
```

### BulletPacket

```typescript
interface BulletPacket {
	typeName: string;
	teamName: string;
	startPos: { x: number; y: number; z: number };
	targetPos: { x: number; y: number; z: number };
	damage: number;
}
```

---

## 응답 코드

| 코드  | 설명                                                      |
| ----- | --------------------------------------------------------- |
| `100` | 성공                                                      |
| `403` | 권한 없음                                                 |
| `404` | 리소스를 찾을 수 없음 (명령어 미등록, Unity 서버 없음 등) |
| `503` | 서비스 이용 불가 (Unity 서버 연결 안됨)                   |

---

## 사용 예제

### 웹 클라이언트 기본 연결

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:7777', {
	query: { clientType: 'web' }
});

// 연결 이벤트
socket.on('connect', () => {
	console.log('서버에 연결되었습니다:', socket.id);
});

// 환영 메시지 수신
socket.on('welcome', (data) => {
	console.log('환영 메시지:', data.message);
	console.log('Unity 서버 연결 상태:', data.unityConnected);
	console.log('연결된 Unity 서버:', data.unityServers);
});

// Unity 서버 연결 알림
socket.on('unity:connected', (data) => {
	console.log('Unity 서버가 연결되었습니다:', data.unitySocketId);
});

// Unity 서버 연결 해제 알림
socket.on('unity:disconnected', (data) => {
	console.log('Unity 서버 연결이 해제되었습니다:', data.unitySocketId);
});
```

### 명령어 전송 (Svelte 서버)

```typescript
// 상태 조회
socket.emit('svelte:command', { cmd: 'status' });

// 서버 정보 조회
socket.emit('svelte:command', { cmd: 'server:info' });

// 응답 수신
socket.on('command:response', (response) => {
	if (response.code === 100) {
		console.log('성공:', response.message);
		console.log('데이터:', response.data);
	} else {
		console.error('오류:', response.message);
	}
});
```

### Unity 서버로 명령어 전송

```typescript
// 모든 Unity 서버로 브로드캐스트
socket.emit('unity:command', {
	cmd: 'game:pause',
	args: { reason: 'maintenance' }
});

// 특정 Unity 서버에만 전송
socket.emit('unity:command', {
	cmd: 'game:pause',
	args: {
		targetUnityId: 'abc123',
		reason: 'maintenance'
	}
});

// 전달 확인
socket.on('command:relayed', (response) => {
	console.log('명령어 전달됨:', response.targetUnityIds);
});
```

### Unity 서버 목록 조회

```typescript
// 목록 요청
socket.emit('unity:list');

// 응답 수신
socket.on('unity:list', (data) => {
	console.log('연결된 Unity 서버 목록:', data.unityServers);
	data.unityServers.forEach((server) => {
		console.log(`- ${server.alias} (ID: ${server.id}), 연결 시간: ${server.connectedAt}`);
	});
});
```

### Unity 서버 별칭 변경

```typescript
// 별칭 변경 요청
socket.emit('unity:set-alias', {
	unitySocketId: 'abc123',
	alias: 'Production Server'
});

// 응답 수신
socket.on('unity:set-alias:response', (response) => {
	if (response.code === 100) {
		console.log('별칭 변경 성공:', response.alias);
	} else {
		console.error('별칭 변경 실패:', response.message);
	}
});

// 다른 클라이언트에서 별칭 변경 알림 수신
socket.on('unity:alias-changed', (data) => {
	console.log(`서버 ${data.unitySocketId}의 별칭이 "${data.alias}"(으)로 변경되었습니다.`);
});
```

### Unity 서버 강제 연결 해제

```typescript
// 연결 해제 요청
socket.emit('unity:disconnect', { unitySocketId: 'abc123' });

// 응답 수신
socket.on('unity:disconnect:response', (response) => {
	if (response.code === 100) {
		console.log('연결 해제 성공:', response.message);
	} else {
		console.error('연결 해제 실패:', response.message);
	}
});
```

### SocketManager 클래스 사용 (권장)

Pixel Server는 `SocketManager` 클래스를 제공하여 소켓 연결을 관리합니다.

```typescript
import { socketManager } from '$lib/socket';

// 연결
const socket = socketManager.connect();

// 상태 확인
console.log('연결 상태:', socketManager.isConnected);
console.log('Unity 연결 상태:', socketManager.isUnityConnected);
console.log('클라이언트 ID:', socketManager.clientId);
console.log('Unity 서버 목록:', socketManager.unityServers);

// 상태 변경 이벤트 구독
socketManager.on('stateChange', (state) => {
	console.log('상태 변경:', state);
});

// 이벤트 구독
socketManager.on('welcome', (data) => {
	console.log('환영:', data);
});

socketManager.on('unity:connected', (data) => {
	console.log('Unity 연결:', data);
});

// 명령어 전송
socketManager.sendSocketEvent('svelte:command', { cmd: 'ping' });

// 재연결
socketManager.reconnect();

// 연결 해제 (앱 종료 시에만 사용)
socketManager.disconnect();
```

---

## 참고 사항

### 자동 재연결

웹 클라이언트는 연결이 끊어져도 자동으로 재연결을 시도합니다:

- 최대 재연결 시도 횟수: 무제한
- 초기 재연결 지연: 1초
- 최대 재연결 지연: 5초

### 다중 Unity 서버 지원

- 여러 Unity 서버가 동시에 연결될 수 있습니다.
- `targetUnityId`를 지정하지 않으면 모든 Unity 서버로 명령어가 브로드캐스트됩니다.
- 특정 서버에만 명령어를 보내려면 `args.targetUnityId`를 지정하세요.

### 이벤트 전달 (Relay)

다음 이벤트들은 Unity 서버에서 발생하여 모든 웹 클라이언트로 자동 전달됩니다:

- `command:response` → `game:response`
- `player:leave`
- `game:log`
- `game:event`

---

## 버전 정보

- **서버 버전**: 1.0.0
- **Socket.IO 버전**: 4.8.1
- **문서 최종 업데이트**: 2024년
