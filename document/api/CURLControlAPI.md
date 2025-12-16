# Control API (POST /api/control)

SvelteKit 라우트 `/api/control`로 외부 시스템(AI 등)이 Socket.IO로 이벤트를 강제 발송할 때 사용합니다.

## 요청 형식

```typescript
{
  token: string;                     // .env의 control_token 값과 일치해야 함
  action: 'socket';                  // 현재 지원되는 유일한 액션
  target: 'unity' | 'webconsole';    // 전송 대상
  event: string;                     // Unity 명령 또는 웹 이벤트 이름
  data?: unknown;                    // 전달할 페이로드 (그대로 전달됨)
}
```

> `Content-Type: application/json` 헤더가 필요합니다.

## 동작

- `target: "unity"`: 연결된 모든 Unity 소켓에 `unity:command` 이벤트를 전송합니다.
  - 페이로드: `{ cmd: event, data }` (Unity에서 그대로 수신)
- `target: "webconsole"`: 모든 웹 콘솔 소켓에 `<event>` 이름으로 `data`를 그대로 브로드캐스트합니다.

## 응답 코드

- `200 OK` : 명령 전송 성공
- `401 Unauthorized` : `token` 불일치
- `501 Not Implemented` : 알 수 없는 action/target

## 예제

### Unity에 명령 보내기

```bash
curl -X POST http://localhost:5173/api/control ^
  -H "Content-Type: application/json" ^
  -d "{ \
    \"token\": \"${CONTROL_TOKEN}\", \
    \"action\": \"socket\", \
    \"target\": \"unity\", \
    \"event\": \"ping\", \
    \"data\": {} \
  }"
```

### 웹 콘솔에 브로드캐스트

```bash
curl -X POST http://localhost:5173/api/control ^
  -H "Content-Type: application/json" ^
  -d "{ \
    \"token\": \"${CONTROL_TOKEN}\", \
    \"action\": \"socket\", \
    \"target\": \"webconsole\", \
    \"event\": \"command:response\", \
    \"data\": { \"code\": 101, \"message\": \"AI broadcast\" } \
  }"
```
