---
name: create-socketio-api-doc
description: Update document/api/SocketIOAPI.md when Socket.IO events change, following the shared format and directional sections.
---

# How to update
- Find emits/on changes in `src/lib/server/socketIO.ts`, `src/lib/server/index.ts`, or `src/lib/socket.ts`.
- Open `document/api/SocketIOAPI.md` and keep existing headers and the four sections (To/From Unity/Web).
- In the matching section’s TypeScript code block, append the event entry using the base pattern:

```typescript
Room: SocketRooms.<UnityServers | WebClients>
event: string
payload:
{
  // payload fields
}
```

- Choose `SocketRooms.UnityServers` for Unity-facing traffic, `SocketRooms.WebClients` for web-facing.
- Leave `payload: {}` if empty; add brief inline comments if helpful.
- Ensure code fences close properly and event names match the server code.

# Quick command
`rg "socket\\.on|socket\\.emit" src/lib/server`
