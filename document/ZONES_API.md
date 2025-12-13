# Zones API 문서

이 문서는 Zones 목록 조회 기능에 대한 설명입니다.

## 개요

Dashboard 페이지에서 Unity 서버의 Zone 정보를 조회하고 표시할 수 있습니다. 이 기능은 `zones:list` 소켓 이벤트를 통해 구현됩니다.

## Zone 데이터 구조

```typescript
interface ZoneInfo {
	name: string;        // Zone 이름
	playerCount: number; // 현재 플레이어 수
	maxPlayers: number;  // 최대 플레이어 수
	status: string;      // Zone 상태 (예: 'active', 'inactive')
}
```

## 사용 방법

### 웹 클라이언트에서 Zones 목록 요청

```typescript
import { socketManager } from '$lib/socket';

// Zones 목록 요청
socketManager.sendSocketEvent('zones:list');

// 특정 Unity 서버에서 Zones 목록 요청
socketManager.sendSocketEvent('zones:list', { targetUnityId: 'server-id' });

// Zones 목록 응답 수신
socketManager.on('zones:list', (data) => {
	if (data.zones) {
		console.log('Zones:', data.zones);
	}
});
```

### Unity 서버에서 Zones 목록 응답

Unity 서버는 `zones:list` 이벤트를 수신하면 다음 형식으로 응답해야 합니다:

```csharp
// Unity에서 zones:list 이벤트 수신
socket.On("zones:list", response =>
{
    var zones = new List<ZoneInfo>();
    
    // Zone 정보 수집
    foreach (var zone in GameZoneManager.GetAllZones())
    {
        zones.Add(new ZoneInfo
        {
            name = zone.Name,
            playerCount = zone.GetPlayerCount(),
            maxPlayers = zone.MaxPlayers,
            status = zone.IsActive ? "active" : "inactive"
        });
    }
    
    // 웹 클라이언트로 응답
    var response = new
    {
        zones = zones
    };
    
    socket.Emit("zones:list", response);
});
```

## 서버 동작 방식

1. 웹 클라이언트가 `zones:list` 이벤트를 서버로 전송
2. 서버는 연결된 Unity 서버로 요청을 전달
3. Unity 서버가 Zone 정보를 수집하여 `zones:list` 이벤트로 응답
4. 서버가 모든 웹 클라이언트에게 응답을 전달

## Dashboard 표시

Dashboard 페이지(`/routes/dashboard`)에서 Zones 정보가 자동으로 표시됩니다:

- Zone 이름
- 현재 플레이어 수 / 최대 플레이어 수
- Zone 상태 (active/inactive)
- 플레이어 수에 따른 프로그레스 바

## 에러 처리

### Unity 서버가 연결되지 않은 경우

```json
{
	"code": 503,
	"message": "Unity 서버가 연결되어 있지 않습니다.",
	"zones": []
}
```

### 특정 Unity 서버를 찾을 수 없는 경우

```json
{
	"code": 404,
	"message": "Unity 서버를 찾을 수 없습니다: {targetUnityId}",
	"zones": []
}
```

## 참고 사항

- `zones:list` 요청 시 `targetUnityId`를 지정하지 않으면 첫 번째 연결된 Unity 서버에 요청을 전송합니다.
- Zone 정보는 실시간으로 갱신되지 않으며, 새로고침 버튼을 클릭하여 최신 정보를 가져올 수 있습니다.
- Zone 데이터 구조는 Unity 서버 구현에 따라 확장될 수 있습니다.
