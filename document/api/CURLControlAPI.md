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
token: CONTROL_AUTH_TOKEN
action: "socket"
target: "unity"
event: "zones:info"
data: {
  zoneId: 0
}
```

## To Unity

```typescript
```

## To Web Console

```typescript
```