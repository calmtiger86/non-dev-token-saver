<div align="center">

# non-dev-token-saver

### Claude가 과소비하지 않게 막아주는 플러그인

[![Version](https://img.shields.io/badge/version-1.0.0-6c63ff.svg?style=flat-square)](https://github.com/calmtiger86/non-dev-token-saver/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-f97316.svg?style=flat-square)](https://claude.ai/code)
[![Platform](https://img.shields.io/badge/platform-Mac%20%7C%20Linux%20%7C%20Windows-0ea5e9.svg?style=flat-square)](#설치)

**한국어 · [English](README.md)**

<br/>

> *Claude Code 요금이 높다고 느꼈다면 — 이유가 있습니다.*  
> *단순한 일까지 가장 비싼 두뇌가 하고 있었습니다.*

</div>

---

## 문제

"이 파일 8개 요약해줘." 간단한 일입니다. 그런데 뒤에서는 Opus 서브에이전트가 뜹니다. 가장 비싼 모델이 100만 토큰당 15달러를 쓰면서 파일을 읽고 있습니다. Haiku면 똑같이 해내는 일인데, 60배 더 비싼 모델이 하고 있는 겁니다.

이런 일이 매번 읽기, 매번 grep, 매번 "이 함수 설명해줘"에서 반복됩니다. 토큰은 쌓입니다. 빠르게.

**non-dev-token-saver**는 서브에이전트가 뜨기 직전에 개입합니다. 이 작업이 생각하는 일인지, 나르는 일인지 판단하고, 맞는 모델을 골라줍니다. 자동으로.

---

## 설치하면

**파일 요약을 시켰을 때:**

```
나:     "이 8개 파일의 주요 export를 요약해줘"

전:     Opus 서브에이전트가 뜹니다. 8개 전부 읽습니다. 정가 청구.

후:     플러그인이 "요약"을 봅니다 — 나르는 일입니다.
        Haiku로 바꿉니다. 같은 결과. 60배 저렴.
```

**같은 파일을 2분 뒤에 다시 읽을 때:**

```
전:     둘 다 그대로 통과합니다. 토큰 두 배.

후:     플러그인이 기억합니다. 같은 파일, 같은 줄, 바뀐 거 없음.
        두 번째 읽기를 막습니다. 토큰 0.
```

**레이스 컨디션을 디버그해달라고 할 때:**

```
나:     "auth 미들웨어에서 레이스 컨디션 디버그해줘"

전:     Opus가 합니다.

후:     Opus가 합니다. 달라진 거 없습니다.
        플러그인이 "디버그"와 "레이스 컨디션"을 봤습니다 — 생각하는 말.
        생각하는 작업은 절대 다운그레이드하지 않습니다. 절대.
```

이게 전부입니다. **나르는 일과 생각하는 일을 구분합니다.** 나르는 일은 저렴한 모델이, 생각하는 일은 비싼 모델이. 예외 없이.

---

## 다섯 겹, 한 번 설치

하나만 하는 플러그인이 아닙니다. 다섯 개 최적화가 겹겹이 쌓여서, 하나가 놓친 토큰을 다른 하나가 잡습니다.

**1층 — 모델 라우팅.** I/O 서브에이전트는 Haiku로, 추론은 Opus로 갑니다. 이중 게이트가 중요한 작업이 다운그레이드되지 않도록 지킵니다. 프롬프트에 추론 키워드가 없어야 하고, 작업 유형이 I/O로 분류돼야 합니다. 둘 다 통과해야 전환됩니다.

**2층 — 읽기 중복 방지.** 이미 읽은 파일이 바뀌지 않았는데 다시 읽는 건 낭비입니다. 플러그인이 세션 안에서 뭘 읽었는지(파일, 줄 범위, 수정 시각) 기억하고 있다가, 중복이면 막습니다.

**3층 — 명령어 재작성.** [RTK](https://github.com/rtk-ai/rtk)가 설치돼 있으면, Bash 출력이 대화에 들어가기 전에 압축됩니다. 명령 하나당 출력 토큰이 줄어듭니다.

**4층 — 훅 캐시.** 라우팅 판단 자체에도 연산이 듭니다. "이 프롬프트 패턴 → Haiku"라고 한번 결정하면 그 답을 메모리와 디스크에 저장합니다. 다음번엔 즉시.

**5층 — 분석.** 세션마다 기록이 남습니다. 입력 토큰, 출력 토큰, 캐시 적중, 소요 시간. 토큰이 어디로 갔는지 볼 수 있습니다.

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

## oh-my-claudecode를 이미 쓰고 있다면

인스톨러가 OMC를 감지하고 알아서 비켜줍니다. OMC가 이미 제공하는 훅 — haiku-router, read guard, RTK rewrite, 캐시 정리 — 은 건너뜁니다. 중복 없고, 충돌 없습니다.

유일하게 항상 설치되는 건 분석 훅입니다. 자기만의 로그 경로에 기록하니까 OMC와 겹칠 일이 없습니다.

---

## 끄고 싶을 때

전부 기본으로 켜져 있습니다. 방해가 되면 환경변수 하나로 끕니다:

```bash
HAIKU_FIRST_DISABLED=true            # 모델 라우팅 전체 중단
TOKEN_OPTIMIZER_READ_GUARD_OFF=true  # 중복 읽기 차단 중단
TOKEN_OPTIMIZER_HAIKU_OFF=true       # haiku 주입만 중단
```

라우팅 토큰 임계값도 올릴 수 있습니다. 기본은 2000입니다. 이보다 작은 작업은 위임 자체를 건너뜁니다 — 절감보다 오버헤드가 더 크니까요:

```bash
HAIKU_FIRST_THRESHOLD=3000
```

---

## 로그는 어디에

세션 분석은 `~/.claude/analytics/non-dev-token-saver/sessions.jsonl`에 남습니다. 세션 하나당 JSON 한 줄 — 입력 토큰, 출력 토큰, 캐시 읽기, 소요 시간, 도구 호출 수.

---

## 파일 구조

```
non-dev-token-saver/
├── hooks/
│   ├── hooks.json              ← 설치 시 자동 등록
│   ├── haiku-router.mjs        ← 모델 라우팅
│   ├── read-guard.mjs          ← 읽기 중복 방지
│   ├── rtk-rewrite.sh          ← 명령어 재작성 (RTK 필요)
│   ├── read-cache-cleanup.mjs  ← 세션 정리
│   ├── token-analytics.mjs     ← 세션 분석
│   └── lib/
│       ├── haiku-first.mjs     ← 라우팅 엔진
│       ├── hook-cache.mjs      ← 이중 계층 캐시
│       └── token-utils.mjs     ← 토큰 추정
├── rules/
│   └── token-optimization.md   ← 최적화 가이드
├── install.js                  ← 크로스 플랫폼 설치 스크립트
├── install.sh                  ← Mac/Linux 단축 실행
└── install.ps1                 ← Windows 단축 실행
```

---

## 제거

```bash
rm -rf ~/.claude/plugins/non-dev-token-saver
```

그다음 `~/.claude/settings.json`을 열어서 `"hooks"` 안에 `non-dev-token-saver`가 들어간 항목을 지우면 됩니다.

---

## 라이선스

MIT © [calmtiger86](https://github.com/calmtiger86)
