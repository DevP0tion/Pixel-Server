# API Format
Section: To Unity | From Unity | To Web | From Web
```
Room: SocketRooms.UnityServers | SocketRooms.WebClients
event: string
payload: payload interface
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
  cmd: string;
  data: Record<string, unknown>; // args from web command (targetUnityId removed)
}
```

```typescript
Room: SocketRooms.UnityServers
event: zones:list
payload:
{}
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
}
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
  data?: any;
}
```

```typescript
Room: SocketRooms.WebClients
event: command:relayed
payload:
{
  code: number;
  message: string;
  targetUnityIds: string[];
  data: { cmd: string; data: Record<string, unknown>; };
}
```

```typescript
Room: SocketRooms.WebClients
event: game:response
payload:
{
  code: number;
  message: string;
  data: any;
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
  target?: 'unity' | 'socketIO';
  args?: Record<string, unknown>;
}
```

```typescript
Room: SocketRooms.WebClients
event: unity:command
payload:
{
  cmd: string;
  target?: 'unity' | 'socketIO';
  args?: Record<string, unknown>; // args.targetUnityId optional for routing to a specific Unity server
}
```

```typescript
Room: SocketRooms.WebClients
event: webToUnity
payload:
{
  cmd: 'unity:command' | 'zones:list';
  data: CommandData | { targetUnityId?: string };
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
event: zones:list
payload:
{
  targetUnityId?: string;
}
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
