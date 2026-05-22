<div align="center">

# non-dev-token-saver

### 토큰을 태우지 마세요. 라우팅하세요.

[![Version](https://img.shields.io/badge/version-1.0.0-6c63ff.svg?style=flat-square)](https://github.com/calmtiger86/non-dev-token-saver/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-f97316.svg?style=flat-square)](https://claude.ai/code)
[![Platform](https://img.shields.io/badge/platform-Mac%20%7C%20Linux%20%7C%20Windows-0ea5e9.svg?style=flat-square)](#설치)

**한국어 · [English](README.md)**

<br/>

> *Opus는 생각하고, Haiku는 나릅니다.*  
> *적재적소에 맞는 모델을 — 자동으로.*

</div>

---

## 문제

Claude Code는 강력합니다. 하지만 서브에이전트 호출, 파일 재독, 장황한 grep — 전부 토큰입니다. 토큰은 돈입니다.

| 모델 | 입력 비용 | 배율 |
|------|----------|------|
| Opus | $15 / 100만 토큰 | 60배 |
| Sonnet | $3 / 100만 토큰 | 12배 |
| **Haiku** | **$0.25 / 100만 토큰** | **1배** |

"이 파일 5개 요약해줘"라고 하면 Opus 서브에이전트가 뜹니다. 건축가한테 짐 옮기기를 시키는 겁니다.

**non-dev-token-saver**가 이걸 고칩니다. 자동으로. 5개 계층에서.

---

## 설치하면

**상황 1 — 요약 작업:**

```
나:      "이 8개 파일의 주요 export를 요약해줘"

플러그인 없이:
  └── Opus 서브에이전트가 뜸 → 8개 파일 전부 읽음 → $$$

플러그인 있을 때:
  └── haiku-router가 I/O 작업 감지
      └── model: 'haiku' 주입 → 같은 결과, 60배 저렴
```

**상황 2 — 같은 파일을 두 번 읽을 때:**

```
나:      (config.json 1-50행 읽기)
나:      (2분 후, config.json 1-50행 다시 읽기)

플러그인 없이:
  └── 둘 다 통과 → 토큰 두 배

플러그인 있을 때:
  └── read-guard가 mtime + 범위 확인
      └── "이미 컨텍스트에 있음" → 두 번째 읽기 차단, 토큰 0
```

**상황 3 — 디버깅 작업:**

```
나:      "auth 미들웨어의 레이스 컨디션 디버그해줘"

플러그인 없이:
  └── 플러그인 있을 때와 동일 — Opus가 처리

플러그인 있을 때:
  └── haiku-router가 추론 키워드 감지 ("디버그", "레이스 컨디션")
      └── 그대로 통과 — 생각하는 작업은 절대 다운그레이드하지 않음
```

핵심: **차이를 압니다.**

---

## 5개 계층

| 계층 | 기능 | 절감 방식 |
|------|------|----------|
| 1. **모델 라우팅** | I/O 서브에이전트를 haiku로 전환 | 라우팅된 호출당 60배 절감 |
| 2. **읽기 중복 방지** | 변경 없는 파일 재독 차단 | 중복 토큰 소비 제거 |
| 3. **명령어 재작성** | RTK로 Bash 출력 압축 | 명령당 출력 토큰 감소 |
| 4. **훅 캐시** | 라우팅 판단 캐싱 (메모리 + 파일) | 반복 분류 건너뜀 |
| 5. **분석** | 세션별 토큰 사용량 기록 | 토큰 흐름 추적 |

---

## 설치

### 방법 A — `claude plugin`으로 설치 (권장)

```bash
claude plugin marketplace add https://github.com/calmtiger86/non-dev-token-saver
claude plugin install non-dev-token-saver@non-dev-token-saver
```

Claude Code 재시작. 끝.

### 방법 B — `omc install`로 설치 (oh-my-claudecode 사용 시)

```bash
omc install https://github.com/calmtiger86/non-dev-token-saver
```

Claude Code 재시작. 끝.

### 방법 C — 직접 설치 (어디서나 동작)

**1단계** — [Node.js](https://nodejs.org)가 설치돼 있는지 확인합니다 (버전 18 이상).  
터미널에서 `node --version`을 실행해서 버전이 나오면 준비 완료입니다.

**2단계** — 이 저장소를 내려받습니다:

```bash
git clone https://github.com/calmtiger86/non-dev-token-saver
cd non-dev-token-saver
```

**3단계** — 설치 스크립트를 실행합니다:

```bash
node install.js
```

**4단계** — Claude Code를 재시작합니다. 끝.

> npm install 없음. 설정 파일 없음. API 키 없음.

---

## 모델 라우팅 원리

```
서브에이전트 호출 들어옴
└── Task 또는 Agent인가?
    ├── 아니오 → 그대로 통과
    └── 예 → 서브에이전트 유형 분류
        ├── REASONING (architect, debugger, security-reviewer, ...)
        │   └── 절대 다운그레이드 안 함. 통과.
        ├── IO_SAFE (explore, writer)
        │   └── 프론트매터가 이미 처리. 통과.
        └── GENERIC (general-purpose, executor)
            └── 이중 게이트 검사:
                ├── 게이트 1: 프롬프트에 추론 키워드 없음?
                ├── 게이트 2: 작업 유형이 I/O? (요약, 번역, 설명...)
                └── 둘 다 통과 → model: 'haiku' 주입
```

18개 추론 유형은 보호됩니다. 일반적인 I/O 작업만 라우팅합니다.

---

## OMC 호환성

이미 [oh-my-claudecode](https://github.com/anthropics/oh-my-claudecode)를 쓰고 있나요? 인스톨러가 자동 감지해서 OMC가 이미 제공하는 훅을 건너뜁니다:

| 훅 | OMC 있을 때 | OMC 없을 때 |
|----|-----------|-----------|
| haiku-router | 건너뜀 (OMC 제공) | 등록 |
| read-guard | 건너뜀 (OMC context-tool-guard) | 등록 |
| rtk-rewrite | 건너뜀 (OMC 제공) | 등록 (RTK 설치 시) |
| read-cache-cleanup | 건너뜀 (OMC 제공) | 등록 |
| **token-analytics** | **항상 등록** | **항상 등록** |

분석 훅은 항상 실행됩니다 — 별도 로그 경로, 충돌 없음.

---

## 설정

모든 기능은 기본 켜짐입니다. 환경변수로 끌 수 있습니다:

| 변수 | 기본값 | 기능 |
|------|-------|------|
| `HAIKU_FIRST_DISABLED=true` | 꺼짐 | 모델 라우팅 전체 비활성화 |
| `HAIKU_FIRST_THRESHOLD=3000` | `2000` | haiku 위임 토큰 임계값 |
| `TOKEN_OPTIMIZER_READ_GUARD_OFF=true` | 꺼짐 | 읽기 중복 방지 비활성화 |
| `TOKEN_OPTIMIZER_HAIKU_OFF=true` | 꺼짐 | haiku 주입만 비활성화 |

---

## 분석

세션 데이터는 `~/.claude/analytics/non-dev-token-saver/sessions.jsonl`에 기록됩니다:

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

선택 사항: Layer 3을 위해 [RTK](https://github.com/rtk-ai/rtk)를 설치하세요. `cargo install rtk` 후 `node install.js`를 다시 실행합니다.

---

## 파일 구조

```
non-dev-token-saver/
├── hooks/
│   ├── hooks.json              ← 설치 시 자동 등록
│   ├── haiku-router.mjs        ← Layer 1: 모델 라우팅
│   ├── read-guard.mjs          ← Layer 2: 읽기 중복 방지
│   ├── rtk-rewrite.sh          ← Layer 3: 명령어 재작성 (RTK)
│   ├── read-cache-cleanup.mjs  ← 세션 정리
│   ├── token-analytics.mjs     ← Layer 5: 세션 분석
│   └── lib/
│       ├── haiku-first.mjs     ← 라우팅 엔진
│       ├── hook-cache.mjs      ← Layer 4: 이중 계층 캐시
│       └── token-utils.mjs     ← CJK 인식 토큰 추정
├── rules/
│   └── token-optimization.md   ← 최적화 가이드
├── install.js                  ← 크로스 플랫폼 설치 스크립트
├── install.sh                  ← Mac/Linux 단축 실행
└── install.ps1                 ← Windows 단축 실행
```

---

## 제거

```bash
# 플러그인 파일 삭제
rm -rf ~/.claude/plugins/non-dev-token-saver

# ~/.claude/settings.json 을 열어서
# "hooks" 섹션 안에 "non-dev-token-saver" 경로가 들어간 항목을 삭제합니다.
```

---

## 라이선스

MIT © [calmtiger86](https://github.com/calmtiger86)
