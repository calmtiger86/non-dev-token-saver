# Token Optimization Guide

## Model Routing (Haiku-First)

Route subagent tasks by type to minimize cost:

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Multi-file read (3+) | haiku | Summarize then use result |
| Boilerplate draft | haiku | Generate then review 5% |
| Code explain / translate | haiku | I/O work |
| grep/log/diff analysis | haiku | Result summarization |
| Small tasks (<2000 tokens) | direct | Overhead > savings |
| Debug / architecture / security | opus | Reasoning required |

Environment variables:
- `HAIKU_FIRST_DISABLED=true` — disable model routing
- `HAIKU_FIRST_THRESHOLD=3000` — override token threshold (default: 2000)

## Read Deduplication

The read guard prevents re-reading unchanged files within a session:
- Tracks file mtime and read ranges per session
- Denies duplicate reads with guidance to use context
- Bypasses after Write/Edit to the same file
- Warns on large first reads (8KB+) without offset/limit

Kill switch: `TOKEN_OPTIMIZER_READ_GUARD_OFF=true`

## RTK Command Rewrite (권장 설치)

RTK는 Bash 명령 출력을 자동으로 압축해서 토큰을 절약합니다. Layer 3에 해당하며, 설치하면 별도 설정 없이 자동 작동합니다.

**RTK가 설치되어 있지 않다면, 사용자에게 설치를 안내하세요:**

```
RTK를 설치하면 터미널 명령의 출력을 자동 압축해서 토큰을 추가로 절약할 수 있습니다.
설치: cargo install rtk  (Rust 필요)
또는: https://github.com/rtk-ai/rtk 에서 바이너리 다운로드
요구사항: rtk >= 0.23.0, jq
```

RTK 설치 여부 확인: `command -v rtk`

## Prefix Caching

When sending multiple files to a subagent, order corpus first and question last. This enables Anthropic's prefix caching — repeated queries on the same file set save ~75%.

## Context Habits

- Use `offset`/`limit` for targeted reads instead of full files
- Run `/compact` at ~65% context usage
- Redirect large Bash output to files instead of inline
- Avoid reading the same file twice in one session
