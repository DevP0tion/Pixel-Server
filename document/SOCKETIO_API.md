# Socket.IO API 문서

Pixel Server의 Socket.IO 통신 API에 대한 상세 문서입니다.

## 목차

1. [개요](#개요)
2. [서버 구조](#서버-구조)
3. [연결 방법](#연결-방법)
4. [클라이언트 타입](#클라이언트-타입)
5. [이벤트 목록](#이벤트-목록)
   - [서버 → Unity](#서버--unity)
   - [Unity → 서버](#unity--서버)
6. [명령어 시스템](#명령어-시스템)
7. [데이터 타입](#데이터-타입)
8. [응답 코드](#응답-코드)
9. [사용 예제](#사용-예제)
10. [웹 애플리케이션 통신](#웹-애플리케이션-통신)

---

## 개요

Pixel Server는 Socket.IO를 사용하여 Unity 게임 서버와 실시간 양방향 통신을 지원합니다. Socket.IO 서버는 포트 **7777**에서 실행되며, Unity 백엔드 통신 전용으로 사용됩니다.

> **참고**: 웹 애플리케이션(콘솔, 대시보드)은 Socket.IO를 사용하지 않습니다. 대신 **Command API**와 **SSE(Server-Sent Events)**를 통해 Unity 서버를 제어하고 로그를 수신합니다.

### 주요 기능

- **Unity 게임 서버와의 실시간 통신**
- **다중 Unity 서버 지원**
- **명령어 기반 통신 시스템**
- **서버 측 Unity 제어 API (`server.unity()`)**

---

## 서버 구조

```
┌─────────────────┐
│   Unity 서버     │
│   (클라이언트)   │
└────────┬────────┘
         │
         │  Socket.IO 연결
         │  (포트: 7777)
         │
         ▼
┌─────────────────────────────────────────┐
│           Pixel Server (SvelteKit)       │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      Socket.IO 서버 (Unity)      │    │
│  │  - 명령어 핸들러                  │    │
│  │  - Unity 서버 관리                │    │
│  │  - server.unity() API            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   웹 애플리케이션 (Command API)   │    │
│  │  - Command API (서버 제어)        │    │
│  │  - SSE (로그 스트리밍)            │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## 연결 방법

### Unity 클라이언트 연결

Unity 클라이언트는 연결 시 `clientType`을 `'unity'`로 설정해야 합니다:

```
쿼리 파라미터: clientType=unity
```

Unity에서의 연결 예제는 [사용 예제](#unity-클라이언트-연결-c) 섹션을 참조하세요.

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
| `unity` | Unity 게임 서버    | `game` (내부 room) |

> **참고**: 이전 버전에서는 `web` 클라이언트 타입이 존재했으나, 현재는 Unity 전용입니다. 웹 통신은 Command API와 SSE를 사용합니다.

### 클라이언트 정보 인터페이스

```typescript
interface ConnectedClient {
	socket: Socket; // 소켓 인스턴스
	id: string; // 소켓 ID
	clientType: 'unity'; // 클라이언트 타입
	authenticated: boolean; // 인증 여부
	username?: string; // 사용자명 (선택)
	connectedAt: Date; // 연결 시간
}
```

---

## 이벤트 목록

### 서버 → Unity

#### `welcome`

Unity 클라이언트 연결 시 전송되는 환영 메시지입니다.

```typescript
// 페이로드
{
  message: string;           // 환영 메시지
  clientId: string;          // 할당된 클라이언트 ID
  clientType: 'unity';       // 클라이언트 타입
  unityConnected: boolean;   // (항상 true)
  unityServers: UnityServerInfo[]; // 연결된 Unity 서버 목록
  serverTime: string;        // 서버 시간 (ISO 8601)
}
```

#### `unity:command`

서버에서 Unity로 명령어를 전송합니다.

```typescript
// 페이로드
{
  cmd: string;                    // 명령어 이름 (예: 'zones:list', 'server:stop')
  data?: Record<string, unknown>; // 전달할 데이터
  token?: string;                 // 선택: 서버 fetch() 호출 시 응답 매칭용
}
```

> **중요**: `server.unity().fetch()` API를 사용할 때 `token`이 포함되며, Unity는 반드시 `unity:response` 이벤트로 동일한 `token`과 함께 응답해야 합니다.

---

### Unity → 서버

#### `unity:command`

Unity 클라이언트가 서버에 명령어를 전송합니다.

```typescript
// 페이로드
{
  cmd: string;                    // 명령어 이름
  args?: Record<string, unknown>; // 명령어 인자 (선택)
}
```

> Unity가 전송하는 경우 서버의 명령어 핸들러에서 직접 처리됩니다.

#### `unity:response`

서버의 `server.unity().fetch()` 호출에 대한 응답입니다.

```typescript
// 페이로드
{
  code: number;    // 응답 코드
  message: string; // 응답 메시지
  data?: unknown;  // 추가 데이터 (선택)
  token: string;   // 서버가 보낸 token을 그대로 반환
}
```

> 이 이벤트는 `server.unity().fetch()` 전용이며, token 기반 매칭을 통해 특정 요청에 대한 응답을 처리합니다.

#### `command:response`

Unity에서 일반 명령어 처리 결과를 전송합니다.

```typescript
// 페이로드 (JSON 문자열)
{
  code: number;    // 응답 코드
  message: string; // 응답 메시지
  data?: unknown;  // 추가 데이터 (선택)
}
```

#### `game:log`

Unity에서 게임 로그를 전송합니다.

```typescript
// 페이로드 - Unity 서버에서 정의한 형식
{
  message: string;
  // ... 기타 필드
}
```

#### `game:event`

Unity에서 게임 이벤트를 전송합니다.

```typescript
// 페이로드 - Unity 서버에서 정의한 형식
{
  type: string;
  // ... 기타 필드
}
```

#### `player:leave`

플레이어가 게임을 떠났을 때 전송됩니다.

```typescript
// 페이로드 - Unity 서버에서 정의한 형식
```

#### `server_status`

Unity 서버의 상태를 전송합니다.

```typescript
// 페이로드
{
  online: boolean;
  timestamp: number; // Unix ms
}
```

#### `zones:list`

게임 존 목록을 전송합니다.

```typescript
// 페이로드 - Unity 서버에서 정의한 형식
{
  zones: Array<{
    id: number;
    playerCount: number;
    additionalInfo: string[];
  }>;
}
```

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
type ClientType = 'unity';
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

        // fetch() 호출인 경우 unity:response로 응답
        if (!string.IsNullOrEmpty(data.token))
        {
            var response = new CommandResponse(100, "Success", JToken.FromObject(new { result = "ok" }));
            response.token = data.token;
            socket.Emit("unity:response", response);
        }
        else
        {
            // 일반 명령어는 command:response로 응답
            var response = new CommandResponse(100, "Success");
            socket.Emit("command:response", response);
        }
    }
}
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

### 서버 측 Unity 제어 API

```typescript
// src/lib/server/socketIO.ts에서 export된 server 객체 사용
import { server } from 'src/hooks.server';

// 특정 Unity 서버로 fetch 요청 (Promise 기반)
const responses = await server.unity('socket-id-123').fetch('zones:list', {});
const zones = JSON.parse(responses[0].data);

// 모든 Unity 서버로 명령 전송 (응답 대기 없음)
server.unity().send('server:stop', {});

// Unity 서버 목록 조회
const unityServers = server.unityServers;

// Unity 서버 별칭 조회
const alias = server.unityServerAliases.get('socket-id-123');
```

---

## 웹 애플리케이션 통신

웹 애플리케이션(콘솔, 대시보드)은 Socket.IO를 사용하지 않습니다. 대신 다음 방식을 사용합니다:

### Command API

Unity 서버를 제어하기 위해 SvelteKit Command API를 사용합니다.

```typescript
// src/routes/dashboard/dashboard.remote.ts
import { command } from '$app/server';
import { server } from 'src/hooks.server';

export const _stopUnityServer = command<
  { unitySocketId: string },
  { success: boolean; message: string }
>('unchecked', async ({ unitySocketId }) => {
  if (!server) {
    return { success: false, message: '서버가 초기화되지 않았습니다.' };
  }
  const unitySocket = server.unityServers.get(unitySocketId);
  if (!unitySocket) {
    return { success: false, message: 'Unity 서버를 찾을 수 없습니다.' };
  }
  unitySocket.emit('server:stop', {});
  return { success: true, message: 'Unity 서버 중지 명령을 전송했습니다.' };
});

export const _setUnityAlias = command<
  { unitySocketId: string; alias: string },
  { success: boolean; message: string }
>('unchecked', async ({ unitySocketId, alias }) => {
  if (!server) {
    return { success: false, message: '서버가 초기화되지 않았습니다.' };
  }
  if (!server.unityServers.has(unitySocketId)) {
    return { success: false, message: 'Unity 서버를 찾을 수 없습니다.' };
  }
  const trimmedAlias = alias?.trim() || 'Game Server';
  server.unityServerAliases.set(unitySocketId, trimmedAlias);
  return { success: true, message: `별칭이 "${trimmedAlias}"(으)로 변경되었습니다.` };
});
```

### SSE (Server-Sent Events)

실시간 로그 스트리밍을 위해 SSE를 사용합니다.

```typescript
// src/routes/console/+server.ts
export async function POST({ request }) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // 로그 스트리밍 설정
  logger.on('log', (log) => {
    writer.write(`data: ${JSON.stringify(log)}\n\n`);
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

---

## 참고 사항

### 자동 재연결

Unity 클라이언트는 연결이 끊어져도 자동으로 재연결을 시도해야 합니다:

- 최대 재연결 시도 횟수: 무제한 권장
- 초기 재연결 지연: 1초
- 최대 재연결 지연: 5초

### 다중 Unity 서버 지원

- 여러 Unity 서버가 동시에 연결될 수 있습니다.
- 각 Unity 서버는 고유한 Socket ID를 가집니다.
- 서버는 `server.unityServers` Map을 통해 모든 Unity 서버를 관리합니다.

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

### Firebase 인증 통합

Unity 클라이언트는 Firebase 인증 토큰을 전송하여 사용자를 검증할 수 있습니다. 자세한 내용은 `AuthPacket` 타입을 참조하세요.

---

## 버전 정보

- **서버 버전**: 1.0.0
- **Socket.IO 버전**: 4.8.1
- **지원 클라이언트**:
  - Unity (SocketIOClient for Unity)
  - ~~웹 브라우저~~ (Deprecated - Command API와 SSE 사용)
- **문서 최종 업데이트**: 2026년 1월
