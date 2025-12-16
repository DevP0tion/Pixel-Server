# API Format
Section: To Unity | To Web
```typescript
token: .env (control_token) string
action: "socket"
target: "unity" | "webconsole"
event: string
data: (json || array) string
```

# Example

(To Unity Section)
```typescript
token: control_token
action: "socket"
target: "unity"
event: "zones:info"
data: {
  zoneId: 0
}
```

## To Unity

```typescript
token: control_token
action: "socket"
target: "unity"
event: "status"
data: {}
// Response: { online: boolean; serverTime: string; uptime: number; }
```

```typescript
token: control_token
action: "socket"
target: "unity"
event: "ping"
data: {}
// Response: { timestamp: number; } // pong echo (Unix ms)
```

```typescript
token: control_token
action: "socket"
target: "unity"
event: "help"
data: {}
// Response: string[] // registered command list
```

```typescript
token: control_token
action: "socket"
target: "unity"
event: "server:info"
data: {}
// Response: {
//   name: string;
//   version: string;
//   unityVersion: string;
//   platform: string;
//   uptime: number;
//   systemMemory: number;
//   graphicsDevice: string;
// }
```

```typescript
token: control_token
action: "socket"
target: "unity"
event: "server:scenes"
data: {}
// Response: Array<{
//   name: string;
//   path: string;
//   isLoaded: boolean;
//   buildIndex: number;
// }>
```

```typescript
token: control_token
action: "socket"
target: "unity"
event: "server:players"
data: {}
// Response: Array<{
//   username: string;
//   ipAddress: string;
//   connectedAt: string; // ISO 8601
// }>
```

```typescript
token: control_token
action: "socket"
target: "unity"
event: "zones:list"
data: {}
// Response: {
//   count: number;
//   zones: Array<{
//     id: number;
//     name: string;
//     position: { x: number; y: number; z: number; };
//     isActive: boolean;
//     playerCount: number;
//   }>;
// }
```

```typescript
token: control_token
action: "socket"
target: "unity"
event: "zones:info"
data: {
  zoneId: number;
}
// Response: {
//   id: number;
//   name: string;
//   position: { x: number; y: number; z: number; };
//   isActive: boolean;
//   objects: Array<{
//     name: string;
//     type: string;
//     position: { x: number; y: number; z: number; };
//   }>;
//   players: Array<{
//     username: string;
//     ipAddress: string;
//     position: { x: number; y: number; z: number; };
//   }>;
// }
// Errors: 400 (missing zoneId) | 404 (zone not found)
```

## To Web Console

```typescript
token: control_token
action: "socket"
target: "webconsole"
event: "command:response" // or any SocketIO event name for web clients
data: {
  code: number;
  message: string;
  data?: any;
}
// Payload is forwarded as-is to connected web consoles
```
