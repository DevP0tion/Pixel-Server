# Pixel-Server

[Pixel-Collector](https://github.com/DevP0tion/Pixel-Collector) 게임의 백엔드 서버입니다. SvelteKit + Socket.IO 기반으로 구축되었으며, Unity 게임 서버와 웹 콘솔 간의 실시간 통신을 담당합니다.

## 프로젝트 구조

```
src/
├── lib/
│   ├── server/           # 서버 로직 (백엔드)
│   │   ├── socketIO.ts   # Socket.IO 서버 설정 및 연결 관리
│   │   ├── SocketCommandHandler.ts  # 명령어 처리 핸들러
│   │   ├── commands.ts   # 기본 명령어 등록
│   │   ├── handlers.ts   # 명령어 핸들러 구현
│   │   ├── types.ts      # 타입 정의
│   │   ├── firebase.ts   # Firebase 인증 초기화
│   │   ├── database/     # 데이터베이스 연결
│   │   └── i18n/         # 서버 다국어 지원
│   └── socket.ts         # 클라이언트 소켓 관리자
├── routes/               # 웹 콘솔 UI
│   ├── console/          # 명령어 콘솔 페이지
│   └── dashboard/        # 대시보드 페이지
└── hooks.server.ts       # 서버 초기화 (DB, Firebase, Socket.IO)
```

## 게임 기능 (Game Features)

Pixel-Collector 게임에서 처리하는 주요 기능:

| 기능 | 설명 | 관련 패킷 |
|------|------|----------|
| 인증 | Firebase 기반 사용자 인증 | `AuthPacket`, `AuthResponseMessage` |
| 이동 | 플레이어 이동 처리 | `MovePacket` |
| 전투 | 총알/공격 시스템 | `BulletPacket` |
| 명령어 | 게임 서버 명령어 실행 | `CommandData`, `CommandResponse` |

## 서버 로직 (Server Logic)

### 1. Socket.IO 서버 (`socketIO.ts`)
- **클라이언트 관리**: Unity 게임 서버와 웹 콘솔 클라이언트 연결 관리
- **메시지 릴레이**: 웹 콘솔 ↔ Unity 서버 간 명령어 및 응답 전달
- **Room 관리**: `game` (Unity), `web` (웹 콘솔) 채널 분리

### 2. 명령어 시스템 (`SocketCommandHandler.ts`)
- **명령어 등록/실행**: Pixel-Collector의 `SocketCommandHandler.cs`와 호환되는 형식
- **명령어 형식**: `{cmd: string, args: {}}`
- **기본 명령어**: `status`, `ping`, `help`, `server:info`

### 3. 데이터베이스 (`database/mysql.ts`)
- MySQL 연결 풀 관리
- 게임 데이터 영속화

### 4. 인증 (`firebase.ts`)
- Firebase Admin SDK 초기화
- 사용자 인증 토큰 검증

## 클라이언트 연결 흐름

```
┌──────────────┐     Socket.IO      ┌──────────────┐
│   Unity      │ ◄──────────────►   │              │
│   (게임서버)  │   clientType:unity │              │
└──────────────┘                    │  Pixel-      │
                                    │  Server      │
┌──────────────┐     Socket.IO      │  (백엔드)    │
│  웹 콘솔     │ ◄──────────────►   │              │
│  (관리도구)   │   clientType:web   │              │
└──────────────┘                    └──────────────┘
```

## 이벤트 목록

### 서버 → 클라이언트
| 이벤트 | 설명 |
|--------|------|
| `welcome` | 연결 환영 메시지 |
| `unity:connected` | Unity 서버 연결 알림 |
| `unity:disconnected` | Unity 서버 연결 해제 알림 |
| `command:response` | 명령어 실행 결과 |
| `game:response` | 게임 응답 (Unity → 웹) |
| `game:log` | 게임 로그 메시지 |
| `game:event` | 게임 이벤트 알림 |

### 클라이언트 → 서버
| 이벤트 | 설명 |
|--------|------|
| `svelte:command` | Svelte 서버에서 로컬 처리 |
| `unity:command` | Unity 서버로 명령어 전달 |
| `unity:list` | Unity 서버 목록 요청 |
| `unity:set-alias` | Unity 서버 별칭 변경 |
| `unity:disconnect` | Unity 서버 강제 연결 해제 |

## 설치 및 실행

### 사전 요구사항
- Node.js 18+
- MySQL
- Firebase 프로젝트 (인증용)

### 설치

```bash
# 의존성 설치
yarn install

# 환경 변수 설정 (.env 파일 생성)
cp .example.env .env
```

### 환경 변수

```env
# MySQL 설정
mysql_address=localhost
mysql_port=3306
mysql_user=root
mysql_password=password
mysql_database=pixel_game

# CORS 설정 (선택)
ALLOWED_ORIGINS=http://localhost:5173
```

### 실행

```bash
# 개발 모드
yarn dev

# 빌드
yarn build

# 프로덕션 미리보기
yarn preview
```

## 관련 저장소

- [Pixel-Collector](https://github.com/DevP0tion/Pixel-Collector) - Unity 게임 클라이언트

## 라이선스

Private
