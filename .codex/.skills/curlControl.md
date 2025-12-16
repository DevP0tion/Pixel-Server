---
name: curl-control
description: Use the curl MCP tool to POST to http://localhost:5173/api/control following document/api/CURLControlAPI.md when asked for CURLControl.
---

# curl MCP tool
- Verified `curl` MCP server (`@mcp-get-community/server-curl`) is available; use the MCP `curl` tool (not shell `curl`).
- Always POST JSON to `http://localhost:5173/api/control` with `Content-Type: application/json`.

# Request schema (document/api/CURLControlAPI.md)
- Fields: `token` (use `.env` `control_token`), `action` (always `"socket"`), `target` (`"unity"` | `"webconsole"`), `event` (socket event name), `data` (object or array; `{}` when none).
- Unity events: `status`, `ping`, `help`, `server:info`, `server:scenes`, `server:players`, `zones:list`, `zones:info` (requires `{ "zoneId": number }`).
- Web console: `command:response` (or any socket event name) with `data: { code: number; message: string; data?: any }`.

```bash
# Body to pass to the MCP curl tool
{
  "method": "POST",
  "url": "http://localhost:5173/api/control",
  "headers": {
    "Content-Type": "application/json"
  },
  "data": {
    "token": "$env:control_token",
    "action": "socket",
    "target": "unity",        # unity | webconsole
    "event": "status",        # e.g., status | ping | zones:info | command:response
    "data": {}                # {} or payload like { "zoneId": 0 }
  }
}
```

# Quick command
`rg "api/control|control_token" src document`
