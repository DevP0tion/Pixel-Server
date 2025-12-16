# API Format
Section: To Unity | From Unity | To Web | From Web
```
Room: SocketRooms.UnityServers | SocketRooms.WebClients
event: string
payload: payload interface (forwarded as-is unless noted)
```

# Example

(To Web Section)
```typescript
Room: SocketRooms.WebClients
event: command:response
payload: 
{
  code: number;
  message: string;
  data: any;
}
```

## To Unity

```typescript
Room: SocketRooms.UnityServers
event: unity:command
payload:
{
  cmd: string;                           // 명령 이름 (예: 'zones:list')
  data?: Record<string, unknown>;        // 전달할 데이터
  token?: string;                        // 선택: 서버 fetch() 호출 시 응답 매칭용
}
```

```typescript
Room: SocketRooms.UnityServers
event: welcome
payload:
{
  message: string;
  clientId: string;
  clientType: 'unity';
  unityConnected: boolean;
  unityServers: Array<{ id: string; connectedAt: string; alias: string; }>;
  serverTime: string;
}
```

## From Unity

```typescript
Room: SocketRooms.UnityServers
event: command:response
payload:
{
  code: number;
  message: string;
  data: any;
  token?: string; // unity.fetch() 응답 매칭용 (선택)
}
// Unity → 서버에서는 JSON 문자열로 전달되며 웹으로는 game:response로 릴레이됩니다.
```

```typescript
Room: SocketRooms.UnityServers
event: unity:response
payload:
{
  code: number;
  message: string;
  data: any;
  token: string; // 서버가 보낸 token을 그대로 반환
}
// 서버의 unity().fetch(...) 호출에 대한 정식 응답 채널
```

```typescript
Room: SocketRooms.UnityServers
event: player:leave
payload:
{
  // forwarded as-is from Unity
}
```

```typescript
Room: SocketRooms.UnityServers
event: game:log
payload:
{
  // forwarded as-is from Unity
}
```

```typescript
Room: SocketRooms.UnityServers
event: game:event
payload:
{
  // forwarded as-is from Unity
}
```

```typescript
Room: SocketRooms.UnityServers
event: server_status
payload:
{
  online: boolean;
  timestamp: number; // Unix ms
}
```

```typescript
Room: SocketRooms.UnityServers
event: zones:list
payload:
{
  // forwarded as-is from Unity
}
```

## To Web

```typescript
Room: SocketRooms.WebClients
event: welcome
payload:
{
  message: string;
  clientId: string;
  clientType: 'web';
  unityConnected: boolean;
  unityServers: Array<{ id: string; connectedAt: string; alias: string; }>;
  serverTime: string;
}
```

```typescript
Room: SocketRooms.WebClients
event: unity:connected
payload:
{
  message: string;
  unitySocketId: string;
  unityServers: Array<{ id: string; connectedAt: string; alias: string; }>;
}
```

```typescript
Room: SocketRooms.WebClients
event: unity:disconnected
payload:
{
  message: string;
  unitySocketId: string;
  unityServers: Array<{ id: string; connectedAt: string; alias: string; }>;
}
```

```typescript
Room: SocketRooms.WebClients
event: unity:alias-changed
payload:
{
  unitySocketId: string;
  alias: string;
  unityServers: Array<{ id: string; connectedAt: string; alias: string; }>;
}
```

```typescript
Room: SocketRooms.WebClients
event: unity:list
payload:
{
  unityServers: Array<{ id: string; connectedAt: string; alias: string; }>;
}
```

```typescript
Room: SocketRooms.WebClients
event: unity:set-alias:response
payload:
{
  code: number;
  message: string;
  unitySocketId?: string;
  alias?: string;
}
```

```typescript
Room: SocketRooms.WebClients
event: unity:disconnect:response
payload:
{
  code: number;
  message: string;
  unitySocketId?: string;
}
```

```typescript
Room: SocketRooms.WebClients
event: command:response
payload:
{
  code: number;
  message: string;
  data?: unknown;
}
// Svelte 서버에서 처리한 명령어 응답 (ping, status 등)
```

```typescript
Room: SocketRooms.WebClients
event: game:response
payload:
{
  // Unity가 보낸 command:response JSON 문자열 그대로 전달됨
  // 필요 시 클라이언트에서 JSON.parse(...)로 변환
}
```

```typescript
Room: SocketRooms.WebClients
event: player:leave
payload:
{
  // forwarded as-is from Unity
}
```

```typescript
Room: SocketRooms.WebClients
event: game:log
payload:
{
  // forwarded as-is from Unity
}
```

```typescript
Room: SocketRooms.WebClients
event: game:event
payload:
{
  // forwarded as-is from Unity
}
```

```typescript
Room: SocketRooms.WebClients
event: server_status
payload:
{
  online: boolean;
  timestamp: number; // Unix ms
}
```

```typescript
Room: SocketRooms.WebClients
event: zones:list
payload:
{
  // forwarded as-is from Unity, or error payload with { code, message, zones }
}
```

## From Web

```typescript
Room: SocketRooms.WebClients
event: svelte:command
payload:
{
  cmd: string;
  args?: Record<string, unknown>;
}
```

```typescript
Room: SocketRooms.WebClients
event: unity:command
payload:
{
  cmd: string;                           // Unity로 전달할 명령
  target?: 'unity' | 'socketIO';         // 기본값: 'unity'
  targetServer?: string[];               // 선택: 특정 Unity 서버 ID 목록 (없으면 전체)
  args?: Record<string, unknown>;        // 명령 인자
}
```

```typescript
Room: SocketRooms.WebClients
event: unity:list
payload:
{}
```

```typescript
Room: SocketRooms.WebClients
event: unity:set-alias
payload:
{
  unitySocketId: string;
  alias: string;
}
```

```typescript
Room: SocketRooms.WebClients
event: unity:disconnect
payload:
{
  unitySocketId: string;
}
```
