---
name: AfterChat
description: 매 사용자 메시지마다 키워드를 추출하여 기존 노드를 탐색하고, 없으면 새 노드를 생성한다. 관련 정보 노드가 있으면 컨텍스트로 로드한다.
---

# How to update

- **트리거**: 모든 사용자 메시지 (시스템 메시지, 빈 메시지 제외)

- **키워드 추출 우선순위**:
  1. 기술 용어: `unity`, `shader`, `blender`, `mirror`, `neo4j`, `tcr`, `treg`, `react`, `python`, `docker`, `mcp`, `llm`, `claude`, `gpt`, `cypher`, `colitis`, `immunology`, `deseq2`, `typescript`, `kubernetes`, `api`
  2. Stopword 제외 후 첫 번째 명사
  3. 3글자 이상 첫 단어 (fallback)

- **Stopwords** (제외 대상):
  - EN: `the`, `a`, `an`, `is`, `are`, `was`, `were`, `be`, `have`, `has`, `do`, `does`, `will`, `would`, `could`, `should`, `this`, `that`, `it`, `i`, `you`, `we`, `they`, `what`, `which`, `who`, `and`, `or`, `but`, `if`, `when`, `where`, `why`, `how`, `all`, `some`, `no`, `not`, `can`, `just`, `now`, `also`, `like`, `want`, `need`, `think`
  - KO: `이`, `그`, `저`, `것`, `수`, `등`, `를`, `을`, `에`, `의`, `가`, `는`, `은`, `로`, `으로`

- **실행 순서**:
  1. 키워드 추출 & sanitize
  2. Neo4j에서 기존 노드 검색
  3. 없으면 새 노드 생성 / 있으면 visits 증가
  4. 연결된 :\_Info 노드 로드 (컨텍스트용)
  5. 세션 상태 업데이트 (RelateNodes용)

- **체크사항**:
  - [ ] Label은 백틱(`)으로 감싸기
  - [ ] 빈 label 방지 (fallback: "unknown")
  - [ ] 숫자 시작 시 "n\_" prefix
  - [ ] 특수문자 제거: `` ` : ' " ( ) ``
  - [ ] 공백 → 언더스코어

```text
# Sanitize 규칙
input: "Unity's Shader!"
output: "unitys_shader"

input: "3D Model"
output: "n_3d_model"

input: "   "
output: "unknown"
```

# Execution flow

```text
User Message
     ↓
┌─────────────────────────────────────────────────────────┐
│                     AfterChat                           │
├─────────────────────────────────────────────────────────┤
│  1. Extract Keyword        → 메시지에서 키워드 추출      │
│  2. Sanitize Label         → 유효한 Neo4j label로 변환   │
│  3. Search Existing Node   → 기존 노드 검색              │
│  4. MERGE Node             → 없으면 생성, 있으면 visits++ │
│  5. Load Related Info      → 연결된 :_Info 로드          │
│  6. Update Session         → prevKeyword, sessionKeywords │
│  7. Create Relations       → FOLLOWED_BY, CO_OCCURS      │
└─────────────────────────────────────────────────────────┘
     ↓
Context ready for response
```

# Cypher templates

```cypher
# 1. 기존 노드 검색
MATCH (n)
WHERE $label IN labels(n)
RETURN n.visits AS visits, n.createdAt AS createdAt
LIMIT 1

# 2. 노드 MERGE (검색 + 생성/업데이트 통합)
MERGE (n:`{label}`)
ON CREATE SET
  n.visits = 1,
  n.priority = 1,
  n.createdAt = timestamp(),
  n.lastVisited = timestamp(),
  n.source = 'AfterChat'
ON MATCH SET
  n.visits = coalesce(n.visits, 0) + 1,
  n.lastVisited = timestamp()
RETURN n.visits AS visits, n.createdAt AS createdAt

# 3. 연결된 정보 노드 로드
MATCH (i:_Info)-[:ABOUT|RELATED_TO]->(k)
WHERE $label IN labels(k)
RETURN i.id AS id, i.summary AS summary, i.createdAt AS createdAt
ORDER BY i.createdAt DESC
LIMIT 3

# 4. FOLLOWED_BY 관계 생성
MATCH (prev), (curr)
WHERE $prevLabel IN labels(prev) AND $currLabel IN labels(curr)
MERGE (prev)-[r:FOLLOWED_BY]->(curr)
ON CREATE SET r.weight = 1.0, r.createdAt = timestamp(), r.lastAccessed = timestamp()
ON MATCH SET r.weight = r.weight + 1.0, r.lastAccessed = timestamp()
RETURN r.weight AS weight

# 5. CO_OCCURS 관계 생성 (세션 내 키워드 간)
MATCH (a), (b)
WHERE $labelA IN labels(a) AND $labelB IN labels(b)
MERGE (a)-[r:CO_OCCURS]-(b)
ON CREATE SET r.weight = 0.5, r.count = 1, r.createdAt = timestamp()
ON MATCH SET r.weight = r.weight + 0.3, r.count = r.count + 1
RETURN r.weight AS weight
```

# Node properties

| Property    | Type   | ON CREATE   | ON MATCH  |
| ----------- | ------ | ----------- | --------- |
| visits      | int    | 1           | +1        |
| priority    | int    | 1           | unchanged |
| createdAt   | long   | timestamp   | unchanged |
| lastVisited | long   | timestamp   | timestamp |
| source      | string | 'AfterChat' | unchanged |

# Session state

```json
{
	"prevKeyword": "shader",
	"sessionKeywords": ["unity", "shader", "mirror"],
	"sessionStart": 1718700000000,
	"messageCount": 5
}
```

| Field           | Type     | Description                       |
| --------------- | -------- | --------------------------------- |
| prevKeyword     | string   | 직전 키워드 (FOLLOWED_BY용)       |
| sessionKeywords | string[] | 세션 내 모든 키워드 (CO_OCCURS용) |
| sessionStart    | number   | 세션 시작 timestamp               |
| messageCount    | number   | 세션 내 메시지 수                 |

# Relation rules

| 관계        | 조건                    | 가중치                 |
| ----------- | ----------------------- | ---------------------- |
| FOLLOWED_BY | prevKeyword ≠ currLabel | +1.0 per occurrence    |
| CO_OCCURS   | 같은 세션 내 등장       | +0.3 per co-occurrence |
| BELONGS_TO  | Topic map에 존재        | 1회 연결               |

# Topic map

| Keywords                                    | Topic            |
| ------------------------------------------- | ---------------- |
| unity, shader, mirror, multiplayer, netcode | game_development |
| blender, terrain, mesh, texture             | 3d_modeling      |
| tcr, treg, colitis, deseq2, repertoire      | immunology       |
| neo4j, cypher, graph                        | database         |
| llm, claude, mcp, embedding                 | ai_ml            |

# Output schema

```json
{
	"currLabel": "shader",
	"isNew": false,
	"visits": 3,
	"relatedInfo": [{ "id": "uuid-1", "summary": "Mirror 네트워킹 설정..." }],
	"relations": {
		"followedBy": { "from": "unity", "weight": 2.0 },
		"coOccurs": [{ "with": "mirror", "weight": 0.8 }]
	},
	"session": {
		"prevKeyword": "shader",
		"sessionKeywords": ["unity", "mirror", "shader"],
		"messageCount": 3
	}
}
```

# Quick command

```bash
# 특정 키워드 노드 조회
MATCH (n) WHERE 'unity' IN labels(n) RETURN n

# 최근 방문 노드 top 10
MATCH (n) WHERE n.source = 'AfterChat' RETURN labels(n)[0] AS keyword, n.visits ORDER BY n.lastVisited DESC LIMIT 10

# 특정 노드의 관계 확인
MATCH (n)-[r]-(m) WHERE 'shader' IN labels(n) RETURN type(r), labels(m), r.weight

# 세션 내 CO_OCCURS 패턴
MATCH (a)-[r:CO_OCCURS]-(b) WHERE r.count > 2 RETURN labels(a), labels(b), r.count ORDER BY r.count DESC
```
