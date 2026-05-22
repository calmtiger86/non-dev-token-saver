# non-dev-token-saver

Claude Code용 5계층 토큰 최적화 플러그인. 자동 모델 라우팅, 읽기 중복 방지, 명령어 재작성, 훅 캐싱, 세션 분석을 통해 토큰 비용을 30~60% 절감합니다.

## 계층 구조

| 계층 | 훅 | 기능 |
|------|-----|------|
| 1. 모델 라우팅 | `haiku-router.mjs` | I/O 서브에이전트 작업 → haiku (opus 대비 60배 저렴) |
| 2. 읽기 중복 방지 | `read-guard.mjs` | 세션 내 변경 없는 파일 재독 방지 |
| 3. 명령어 재작성 | `rtk-rewrite.sh` | RTK로 Bash 명령어 출력 압축 |
| 4. 훅 캐시 | `hook-cache.mjs` | 이중 계층 (메모리 + 파일) 캐시 (TTL) |
| 5. 분석 | `token-analytics.mjs` | 세션별 토큰 사용량 로깅 |

## 설치

```bash
node install.js
```

인스톨러 동작:
- 플러그인 파일을 `~/.claude/plugins/non-dev-token-saver/`에 복사
- `~/.claude/settings.json`에 훅 등록
- OMC(oh-my-claudecode) 자동 감지 — 중복 훅 건너뜀
- RTK 자동 감지 — 설치되어 있으면 재작성 훅 등록

## 요구사항

- Node.js 18+
- Claude Code CLI
- 선택: [RTK](https://github.com/rtk-ai/rtk) >= 0.23.0 + `jq` (명령어 재작성용)

## 설정

| 환경변수 | 기본값 | 설명 |
|---------|--------|------|
| `HAIKU_FIRST_DISABLED` | `false` | 모델 라우팅 전체 비활성화 |
| `HAIKU_FIRST_THRESHOLD` | `2000` | haiku 위임 토큰 임계값 |
| `TOKEN_OPTIMIZER_READ_GUARD_OFF` | `false` | 읽기 중복 방지 비활성화 |
| `TOKEN_OPTIMIZER_HAIKU_OFF` | `false` | 라우터의 haiku 주입 비활성화 |

## 모델 라우팅 원리

haiku-router는 서브에이전트 유형을 3단계로 분류합니다:

- **REASONING** (analyst, architect, debugger 등) — 절대 다운그레이드 안 함
- **IO_SAFE** (explore, writer) — 프론트매터가 이미 처리
- **GENERIC** (general-purpose, executor) — 이중 게이트 검사:
  1. 프롬프트에 추론 키워드 없음
  2. 작업 유형이 I/O로 감지됨 (요약, 번역, 설명 등)

두 게이트를 모두 통과해야 `model: 'haiku'`를 주입합니다.

## OMC 호환성

oh-my-claudecode와 함께 작동합니다. 인스톨러가 OMC를 감지하면 이미 제공되는 훅(haiku-router, context-tool-guard, read-cache-cleanup, rtk-rewrite)의 등록을 건너뜁니다. 분석 훅은 별도 로그 경로로 항상 등록됩니다.

## 분석

세션 데이터는 `~/.claude/analytics/non-dev-token-saver/sessions.jsonl`에 JSONL 형식으로 기록됩니다:

```json
{
  "timestamp": "2026-05-22T10:30:00.000Z",
  "inputTokens": 150000,
  "outputTokens": 5000,
  "cacheRead": 80000,
  "duration": 300000,
  "toolCalls": 45
}
```

## 라이선스

MIT
