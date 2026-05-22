<div align="center">

# non-dev-token-saver

### Claude가 과소비하지 않게 막아주는 플러그인

[![Version](https://img.shields.io/badge/version-1.0.0-6c63ff.svg?style=flat-square)](https://github.com/calmtiger86/non-dev-token-saver/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-f97316.svg?style=flat-square)](https://claude.ai/code)
[![Platform](https://img.shields.io/badge/platform-Mac%20%7C%20Linux%20%7C%20Windows-0ea5e9.svg?style=flat-square)](#설치)

**한국어 · [English](README.md)**

<br/>

> *Claude Code 토큰이 부족하다고 느꼈다면, 이유가 있습니다.*  
> *단순한 일까지 가장 비싼 모델이 일하고 있었습니다.*

</div>

---

## 문제

"이 파일 8개 요약해줘." 간단한 일입니다. 그런데 뒤에서는 Opus 서브에이전트가 뜹니다. 가장 비싼 모델이 100만 토큰당 15달러를 쓰면서 파일을 읽고 있습니다. Haiku로 똑같이 할수있는 일인데, 60배 더 비싼 모델이 하고 있는 겁니다.

이런 일이 매번 읽기, 매번 grep, 매번 "이 함수 설명해줘"에서 반복됩니다. 토큰은 대량 소비됩니다. 빠르게.

**non-dev-token-saver**는 서브에이전트가 뜨기 직전에 개입합니다. 이 작업이 생각하는 일인지, 나르는 일인지 판단하고, 맞는 모델을 골라줍니다. 자동으로.

---

## 설치하면

**상황 1 — 파일 요약을 시켰을 때:**

```
나:      "이 8개 파일의 주요 export를 요약해줘"

플러그인 없이:
  └── 가장 비싼 모델이 뜸 → 8개 파일 전부 읽음 → $$$

플러그인 있을 때:
  └── "요약"이라는 말을 봄 — 단순 작업으로 판단
      └── 저렴한 모델로 전환 → 같은 결과, 60배 저렴
```

**상황 2 — 같은 파일을 두 번 읽을 때:**

```
나:      (설정 파일 1~50줄 읽기)
나:      (2분 후, 같은 파일 같은 줄 다시 읽기)

플러그인 없이:
  └── 둘 다 통과 → 토큰 두 배

플러그인 있을 때:
  └── "이 파일 아까 읽었는데, 그 뒤로 바뀐 게 없네요"
      └── 두 번째 읽기 차단 → 토큰 0
```

**상황 3 — 어려운 버그를 고쳐달라고 할 때:**

```
나:      "로그인 쪽에 동시 접속 버그가 있어, 원인 찾아줘"

플러그인 없이:
  └── 비싼 모델이 처리

플러그인 있을 때:
  └── 비싼 모델이 처리. 고성능 모델 작업임을 판단.
      "버그", "원인" — 생각이 필요한 말이 보였기 때문.
      생각하는 작업은 절대 싼 모델로 바꾸지 않습니다.
```

핵심은 이겁니다. **단순한 일과 복잡한 일을 구분합니다.** 단순한 일은 저렴한 모델이, 복잡한 일은 비싼 모델이. 품질을 떨어뜨리지 않으면서 비용만 줄입니다.

---

## 어떻게 작동하나요?

비유로 설명하면, 회사에 경력 20년 부장님과 일 잘하는 인턴이 있다고 생각해 보세요.

지금까지는 서류 복사, 파일 정리, 회의록 요약 같은 일까지 전부 부장님이 하고 있었습니다. 인턴이면 충분한 일에 부장님 인건비가 나가고 있었던 겁니다.

이 플러그인은 일감이 들어올 때마다 "이건 부장님이 해야 하나, 인턴이면 되나?" 를 판단합니다. 다섯 가지 방법으로요.

**1 — 일감 분배.** "요약해줘", "번역해줘", "설명해줘" 같은 단순 작업은 저렴한 모델(인턴)에게 보냅니다. "버그 찾아줘", "설계 검토해줘", "보안 점검해줘" 같은 작업은 비싼 모델(부장님)이 그대로 합니다. 두 가지 검문을 통과해야만 전환되니까, 중요한 일이 인턴에게 가는 일은 없습니다.

**2 — 같은 서류 두 번 복사 안 하기.** 아까 읽은 파일을 또 읽으려고 하면, "이미 읽었고, 그 사이에 바뀐 것도 없다"고 알려주면서 막습니다. 같은 서류를 복사기로 두 번 돌리지 않는 것과 같습니다.

**3 — 보고서 요약본 받기.** 터미널 명령의 출력이 길면, 핵심만 추려서 대화에 넣습니다. 100페이지 보고서 대신 1페이지 요약을 받는 셈입니다. ([RTK](https://github.com/rtk-ai/rtk) 설치 시 작동)

**4 — 한번 내린 판단은 메모.** "이 종류의 작업 → 인턴"이라고 한번 결정하면 적어둡니다. 똑같은 종류의 일이 다시 들어오면 판단 과정 없이 바로 배정합니다.

**5 — 가계부.** 세션마다 토큰을 얼마나 썼는지 기록합니다. 어디서 토큰이 빠져나가는지 눈으로 볼 수 있습니다.

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
