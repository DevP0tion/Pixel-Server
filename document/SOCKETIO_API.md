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
| `web`   | 웹 콘솔 클라이언트 | `web_clients` |
| `unity` | Unity 게임 서버    | `unity_servers` |

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

명령어 실행 결과를 전송합니다. (Svelte/Socket.IO에서 직접 처리한 응답)

```typescript
// 페이로드
{
  code: number;    // 응답 코드
  message: string; // 응답 메시지
  data?: unknown;  // 추가 데이터 (선택)
}
```

#### `game:response`

Unity 서버에서 온 `command:response`를 웹 클라이언트에 그대로 전달합니다.

```typescript
// 페이로드
// Unity가 보낸 JSON 문자열(예: CommandResponse). 필요 시 JSON.parse(...) 호출
```

> 서버의 `unity().fetch(...)`를 사용할 때는 Unity가 동일한 형식에 `token`을 포함해 `unity:response` 이벤트로 응답해야 합니다. (웹 클라이언트로 브로드캐스트되지 않음)

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

**웹 클라이언트가 전송하는 경우:** `target`에 따라 Unity로 전달하거나 Socket.IO에서 직접 처리합니다.

```typescript
// 페이로드
{
  cmd: string;                    // 명령어 이름
  target?: 'unity' | 'socketIO';  // 기본값: 'unity'
  targetServer?: string[];        // 선택: 특정 Unity 서버 ID 목록 (없으면 전체 전달)
  args?: Record<string, unknown>; // 명령 인자
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
	alias: string; // 새 별칭 (빈 문자열이면 'Game Server'로 설정)
}
```

**응답 이벤트:**

- `unity:set-alias:response`: 요청한 클라이언트에게 응답
- `unity:alias-changed`: 모든 웹 클라이언트에게 변경 알림

---

## 명령어 시스템

### Svelte 서버 등록 명령어

| 명령어        | 설명                       | 응답 이벤트        | 예제 |
| ------------- | -------------------------- | ------------------ | ---- |
| `ping`        | 서버 연결 확인 (pong 응답) | `command:response` | `ping` |
| `status`      | 서버 상태 조회 (연결된 클라이언트 수, 서버 시간) | `command:response` | `status` |
| `help`        | 사용 가능한 명령어 목록    | `command:response` | `help` |
| `server:info` | 서버 상세 정보 조회 (버전, 가동시간, 메모리 등) | `command:response` | `server:info` |

### 명령어 데이터 형식

```typescript
interface CommandData {
	cmd: string; // 명령어 이름
	target?: CommandTarget; // 'unity' | 'socketIO' (기본값: unity)
	targetServer?: string[]; // 선택: 특정 Unity 서버 ID 목록
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

### Svelte 서버에 커스텀 명령어 추가

`src/lib/server/commands.ts` 파일에서 커스텀 명령어를 추가할 수 있습니다:

```typescript
import type { SocketCommandHandler } from './SocketCommandHandler.js';

export function loadCommands(
	commandHandler: SocketCommandHandler,
	connectedClients: Map<string, ConnectedClient>
) {
	// 기존 명령어들...
	
	// 커스텀 명령어 추가
	commandHandler.registerCommand('custom:hello', (socket, args) => {
		const name = args?.name || 'World';
		socket.emit('command:response', {
			code: 100,
			message: `Hello, ${name}!`,
			data: { timestamp: new Date().toISOString() }
		});
	});
	
	commandHandler.registerCommand('custom:stats', (socket, args) => {
		// 통계 정보 반환
		socket.emit('command:response', {
			code: 100,
			message: '서버 통계',
			data: {
				totalClients: connectedClients.size,
				uptime: process.uptime()
			}
		});
	});
}
```

### 명령어 실행 예제

```typescript
// ping 명령어
socket.emit('svelte:command', { cmd: 'ping' });

// 인자가 있는 명령어
socket.emit('svelte:command', { 
	cmd: 'custom:hello', 
	args: { name: 'Alice' } 
});

// 결과 수신
socket.on('command:response', (response) => {
	console.log(response);
	// { code: 100, message: 'Hello, Alice!', data: { timestamp: '...' } }
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

### CommandTarget

```typescript
type CommandTarget = 'unity' | 'socketIO';
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

---

## 응답 코드

| 코드  | 설명                                                      |
| ----- | --------------------------------------------------------- |
| `100` | 성공                                                      |
| `101` | 일반 메시지 (정보 전달용)                                  |
| `403` | 권한 없음                                                 |
| `404` | 리소스를 찾을 수 없음 (명령어 미등록, Unity 서버 없음 등) |
| `503` | 서비스 이용 불가 (Unity 서버 연결 안됨)                   |

> **참고**: Unity의 `CommandResponse` 클래스는 `Success()`, `Message()`, `Error()` 헬퍼 메서드를 제공합니다.

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

### Unity 클라이언트 연결 (C#)

```csharp
using SocketIOClient;
using Newtonsoft.Json.Linq;

public class NetworkManager : MonoBehaviour
{
    private SocketIOUnity socket;
    
    void Start()
    {
        var uri = new Uri("http://localhost:7777");
        socket = new SocketIOUnity(uri, new SocketIOOptions
        {
            Query = new Dictionary<string, string>
            {
                {"clientType", "unity"}
            },
            Transport = SocketIOClient.Transport.TransportProtocol.WebSocket
        });
        
        // 환영 메시지 수신
        socket.On("welcome", response =>
        {
            var data = response.GetValue<JObject>();
            Debug.Log($"Connected: {data["message"]}");
        });
        
        // 명령어 수신
        socket.On("unity:command", response =>
        {
            var commandData = response.GetValue<CommandData>();
            HandleCommand(commandData);
        });
        
        socket.Connect();
    }
    
    void HandleCommand(CommandData data)
    {
        Debug.Log($"Command received: {data.cmd}");
        
        // 명령어 처리 후 응답
        var response = new CommandResponse(100, "Success", JToken.FromObject(new { result = "ok" }));
        socket.Emit("command:response", response);
    }
}
```

### 명령어 전송 (Svelte 서버)

```typescript
// 상태 조회
socket.emit('svelte:command', { cmd: 'status' });

// 서버 정보 조회
socket.emit('svelte:command', { cmd: 'server:info' });

// 도움말
socket.emit('svelte:command', { cmd: 'help' });

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

### Unity에서 커스텀 명령어 등록

```csharp
using PixelCollector.Networking.Server;

public class MyGameCommands : MonoBehaviour
{
    private SocketCommandHandler commandHandler;
    
    void Start()
    {
        commandHandler = GetComponent<SocketCommandHandler>();
        
        // 커스텀 명령어 등록
        commandHandler.RegisterCommand("game:pause", "게임을 일시정지합니다", HandlePauseCommand);
        commandHandler.RegisterCommand("player:count", "플레이어 수를 반환합니다", HandlePlayerCount);
        commandHandler.RegisterCommand("server:restart", "서버를 재시작합니다", HandleServerRestart);
    }
    
    CommandResponse HandlePauseCommand(SocketIOUnity socket, CommandData args)
    {
        // 게임 일시정지 로직
        Time.timeScale = 0;
        
        return CommandResponse.Success("게임이 일시정지되었습니다");
    }
    
    CommandResponse HandlePlayerCount(SocketIOUnity socket, CommandData args)
    {
        int count = NetworkServer.connections.Count;
        
        return CommandResponse.Success("플레이어 수 조회 성공", 
            JToken.FromObject(new { playerCount = count }));
    }
    
    CommandResponse HandleServerRestart(SocketIOUnity socket, CommandData args)
    {
        // 재시작 로직
        StartCoroutine(RestartServer());
        
        return CommandResponse.Success("서버 재시작을 시작합니다");
    }
}

### Unity 서버로 명령어 전송

```typescript
// 모든 Unity 서버로 브로드캐스트
socket.emit('unity:command', {
	cmd: 'game:pause',
	target: 'unity',
	args: { reason: 'maintenance' }
});

// 특정 Unity 서버에만 전송
socket.emit('unity:command', {
	cmd: 'game:pause',
	target: 'unity',
	targetServer: ['abc123'],
	args: { reason: 'maintenance' }
});

// Unity 서버로부터의 응답 수신
socket.on('game:response', (raw) => {
	const response = typeof raw === 'string' ? JSON.parse(raw) : raw;
	console.log('Unity 응답:', response);
});
```

### Unity에서 명령어 응답 전송

```csharp
// 성공 응답
var response = CommandResponse.Success("작업 완료", 
    JToken.FromObject(new { result = "ok", timestamp = DateTime.Now }));
socket.Emit("command:response", response);

// 메시지 응답 (정보 전달)
var message = CommandResponse.Message("서버 상태: 정상", "플레이어 수: 10명");
socket.Emit("command:response", message);

// 에러 응답
var error = CommandResponse.Error(404, "플레이어를 찾을 수 없습니다");
socket.Emit("command:response", error);
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
const { servers } = socketManager.unityServers();
console.log('Unity 서버 목록:', servers);

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
socketManager.getSocket()?.emit('svelte:command', { cmd: 'ping' }); // Svelte 서버 핑
socketManager.unityServers().send('zones:list');                    // 모든 Unity 서버에 zones:list
socketManager.unityServers('abc123').send('ping');                  // 특정 Unity 서버에 ping

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
- `targetServer`를 지정하지 않으면 모든 Unity 서버로 명령어가 브로드캐스트됩니다.
- 특정 서버에만 명령어를 보내려면 `targetServer: ['소켓ID']`를 payload에 포함하세요.

### 이벤트 전달 (Relay)

다음 이벤트들은 Unity 서버에서 발생하여 모든 웹 클라이언트로 자동 전달됩니다:

- `command:response` → `game:response`
- `player:leave`
- `game:log`
- `game:event`

### Unity 명령어 형식

Unity에서 수신하는 명령어 형식은 다음과 같습니다:

```json
{
  "cmd": "명령어이름",
  "data": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

웹 콘솔에서 `unity:command` 이벤트로 전송할 때 `targetServer`는 라우팅에만 사용되며, `args`는 수정 없이 Unity에 전달됩니다.

### 웹 콘솔 명령어 파싱

웹 콘솔(`/console` 페이지)에서는 다음 형식으로 명령어를 입력할 수 있습니다:

```bash
# 기본 형식
commandName

# JSON 인자 형식
commandName {"key": "value", "number": 123}

# key=value 형식
commandName key1=value1 key2=123 key3=true
```

### Firebase 인증 통합

Unity 클라이언트는 Firebase 인증 토큰을 전송하여 사용자를 검증할 수 있습니다. 자세한 내용은 `AuthPacket` 타입을 참조하세요.

---

## 버전 정보

- **서버 버전**: 1.0.0
- **Socket.IO 버전**: 4.8.1
- **지원 클라이언트**: 
  - Unity (SocketIOClient for Unity)
  - 웹 브라우저 (socket.io-client 4.x)
- **문서 최종 업데이트**: 2025년 12월
