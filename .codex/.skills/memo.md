---
name: Memo
description: 사용자가 메모를 요청할 때 답변 내용을 정보 노드(:_Info)로 생성하고, 관련 키워드 노드에 연결한다. 관련 노드 탐색은 요청마다 한 단계씩 점진적으로 수행한다.
---

# How to update

- **트리거 키워드**:
  - 메모 생성: `메모`, `기억`, `저장`, `기록`, `노트`, `memo`, `remember`, `save`, `note`, `잊지마`, `기억해`, `메모해`, `저장해`
  - 추가 탐색: `더 찾아`, `더 탐색`, `관련된 거`, `expand`, `more`

- **트리거 감지 로직**:

  ```python
  MEMO_TRIGGERS = ["메모", "기억", "저장", "기록", "노트", "memo", "remember", "save", "note"]
  EXPAND_TRIGGERS = ["더 찾아", "더 탐색", "관련", "expand", "more"]

  def get_trigger_type(message: str) -> str | None:
      msg = message.lower()
      if any(t in msg for t in MEMO_TRIGGERS):
          return "memo"
      if any(t in msg for t in EXPAND_TRIGGERS):
          return "expand"
      return None
  ```

- **실행 순서 (메모 생성)**:
  1. 대화 컨텍스트에서 핵심 키워드 추출 (복수)
  2. 답변 내용 요약 (max 200자)
  3. :\_Info 노드 생성
  4. 키워드 노드와 [:ABOUT] 관계 연결
  5. 1단계 관련 노드 탐색 → [:RELATED_TO] 연결
  6. 세션에 lastMemoId, lastMemoDepth 저장

- **실행 순서 (추가 탐색)**:
  1. 세션에서 lastMemoId 로드
  2. 현재 연결된 노드들의 이웃 탐색 (depth +1)
  3. 새로 발견된 노드에 [:RELATED_TO] 연결
  4. searchDepth 업데이트

- **체크사항**:
  - [ ] UUID 형식의 info_id
  - [ ] summary 최대 200자
  - [ ] 탐색 시 중복 연결 방지
  - [ ] depth별 최대 5개 노드 제한
  - [ ] 세션 상태 업데이트

# Execution flow

```text
User: "이거 메모해줘"
     ↓
┌─────────────────────────────────────────────────────────┐
│                    OnMemoRequest                        │
├─────────────────────────────────────────────────────────┤
│  1. Extract Keywords       → 복수 키워드 추출            │
│  2. Summarize Response     → 답변 요약 (200자)          │
│  3. Create :_Info Node     → 정보 노드 생성              │
│  4. Link via [:ABOUT]      → 키워드와 직접 연결          │
│  5. Search Depth 1         → 관련 노드 1단계 탐색        │
│  6. Link via [:RELATED_TO] → 발견된 노드 연결            │
│  7. Update Session         → lastMemoId 저장            │
└─────────────────────────────────────────────────────────┘

User: "관련된 거 더 찾아줘"
     ↓
┌─────────────────────────────────────────────────────────┐
│                   OnExpandRequest                       │
├─────────────────────────────────────────────────────────┤
│  1. Load lastMemoId        → 세션에서 이전 메모 로드     │
│  2. Get Current Neighbors  → 현재 연결된 노드 수집       │
│  3. Search Next Depth      → depth +1 탐색              │
│  4. Link New Nodes         → [:RELATED_TO] 연결         │
│  5. Update searchDepth     → 깊이 증가                  │
└─────────────────────────────────────────────────────────┘
```

# Node schemas

## :\_Info (정보 노드)

```cypher
CREATE (i:_Info {
  id: '{uuid}',
  summary: '{요약된 내용}',
  fullText: '{원문 또는 상세 내용}',
  createdAt: timestamp(),
  source: 'Memo',
  searchDepth: 0
})
```

| Property    | Type   | Description      |
| ----------- | ------ | ---------------- |
| id          | string | UUID v4          |
| summary     | string | 요약 (max 200자) |
| fullText    | string | 원문 (max 500자) |
| createdAt   | long   | 생성 timestamp   |
| source      | string | 'Memo'           |
| searchDepth | int    | 현재 탐색 깊이   |

## 관계 타입

| 관계          | 방향               | 설명                           |
| ------------- | ------------------ | ------------------------------ |
| [:ABOUT]      | :\_Info → :Keyword | 정보의 주제 키워드 (직접 추출) |
| [:RELATED_TO] | :\_Info → :Keyword | 탐색으로 발견된 관련 키워드    |

### [:RELATED_TO] 속성

| Property     | Type   | Description           |
| ------------ | ------ | --------------------- |
| discoveredAt | long   | 발견 timestamp        |
| depth        | int    | 발견된 탐색 깊이      |
| viaKeyword   | string | 어떤 키워드 통해 발견 |

# Cypher templates

```cypher
# 1. 정보 노드 생성
CREATE (i:_Info {
  id: $infoId,
  summary: $summary,
  fullText: $fullText,
  createdAt: timestamp(),
  source: 'Memo',
  searchDepth: 0
})
RETURN i.id AS id

# 2. 키워드와 직접 연결 (ABOUT)
MATCH (i:_Info {id: $infoId})
MATCH (k) WHERE $keyword IN labels(k)
MERGE (i)-[r:ABOUT]->(k)
ON CREATE SET r.createdAt = timestamp()
RETURN labels(k)[0] AS linked

# 3. 1단계 관련 노드 탐색 및 연결
MATCH (i:_Info {id: $infoId})-[:ABOUT]->(k)
MATCH (k)-[:FOLLOWED_BY|CO_OCCURS|BELONGS_TO]-(neighbor)
WHERE NOT (i)-[:ABOUT]->(neighbor)
  AND NOT (i)-[:RELATED_TO]->(neighbor)
WITH DISTINCT i, neighbor, labels(k)[0] AS viaKeyword
LIMIT 5
MERGE (i)-[r:RELATED_TO]->(neighbor)
ON CREATE SET
  r.discoveredAt = timestamp(),
  r.depth = 1,
  r.viaKeyword = viaKeyword
RETURN labels(neighbor)[0] AS found

# 4. searchDepth 업데이트
MATCH (i:_Info {id: $infoId})
SET i.searchDepth = $newDepth
RETURN i.searchDepth AS depth

# 5. 추가 탐색 (depth +1)
MATCH (i:_Info {id: $infoId})-[:ABOUT|RELATED_TO]->(k)
MATCH (k)-[:FOLLOWED_BY|CO_OCCURS|BELONGS_TO]-(neighbor)
WHERE NOT (i)-[:ABOUT]->(neighbor)
  AND NOT (i)-[:RELATED_TO]->(neighbor)
WITH DISTINCT i, neighbor, labels(k)[0] AS viaKeyword
LIMIT 5
MERGE (i)-[r:RELATED_TO]->(neighbor)
ON CREATE SET
  r.discoveredAt = timestamp(),
  r.depth = $nextDepth,
  r.viaKeyword = viaKeyword
RETURN labels(neighbor)[0] AS found
```

# Incremental search logic

```text
Depth 0: 직접 연결된 키워드만 (ABOUT)
         [unity] ← Info → [shader]
              ↓
Depth 1: ABOUT 노드들의 이웃
         [mirror] ← RELATED_TO ← Info
         [multiplayer] ← RELATED_TO ← Info
              ↓
Depth 2: Depth 1 노드들의 이웃
         [netcode] ← RELATED_TO ← Info
         [server] ← RELATED_TO ← Info
              ↓
         ... (요청 시마다 +1)
```

### 탐색 제한

- 각 depth에서 최대 **5개** 노드 발견
- 이미 연결된 노드는 제외
- 무한 확장 방지: 사용자 요청 시에만 다음 depth

# Session state

```json
{
	"lastMemoId": "550e8400-e29b-41d4-a716-446655440000",
	"lastMemoDepth": 1,
	"lastMemoKeywords": ["unity", "shader"]
}
```

| Field            | Type     | Description              |
| ---------------- | -------- | ------------------------ |
| lastMemoId       | string   | 가장 최근 생성된 메모 ID |
| lastMemoDepth    | int      | 현재 탐색 깊이           |
| lastMemoKeywords | string[] | 메모의 직접 키워드       |

# Output schema

## 메모 생성 결과

```json
{
	"action": "memo_created",
	"infoId": "550e8400-e29b-41d4-a716-446655440000",
	"summary": "Mirror 네트워킹에서 NetworkManager 설정...",
	"keywords": ["unity", "mirror", "networking"],
	"relatedFound": {
		"depth": 1,
		"nodes": ["shader", "multiplayer"],
		"count": 2
	},
	"session": {
		"lastMemoId": "550e8400-...",
		"lastMemoDepth": 1,
		"lastMemoKeywords": ["unity", "mirror", "networking"]
	}
}
```

## 추가 탐색 결과

```json
{
	"action": "memo_expanded",
	"infoId": "550e8400-e29b-41d4-a716-446655440000",
	"previousDepth": 1,
	"newDepth": 2,
	"newlyFound": ["netcode", "server"],
	"totalRelated": 4
}
```

# Quick command

```bash
# 메모 트리거 확인
rg "(메모|기억|저장|memo|remember)" <message>

# 모든 정보 노드 조회
MATCH (i:_Info) RETURN i.id, i.summary, i.searchDepth ORDER BY i.createdAt DESC LIMIT 10

# 특정 키워드에 연결된 정보
MATCH (i:_Info)-[:ABOUT]->(k) WHERE 'unity' IN labels(k) RETURN i.summary, i.createdAt

# 탐색 깊이별 연결 현황
MATCH (i:_Info)-[r:RELATED_TO]->(k) RETURN i.id, r.depth, labels(k)[0] ORDER BY r.depth

# 특정 메모의 전체 연결 그래프
MATCH (i:_Info {id: $infoId})-[r:ABOUT|RELATED_TO]->(k) RETURN i, r, k
```

# Integration with AfterChat

- AfterChat이 먼저 실행되어 키워드 노드가 존재함을 보장
- Memo는 기존 키워드 노드에 :\_Info를 연결
- AfterChat의 FOLLOWED_BY, CO_OCCURS 관계를 탐색에 활용

```text
AfterChat (매 메시지)     Memo (트리거 시)
        ↓                      ↓
  키워드 노드 생성    →    :_Info 연결
  관계 생성          →    관계 따라 탐색
```
