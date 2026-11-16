<div align="center">

# non-dev-token-saver

### Claude Code의 토큰 사용을 돌아보게 돕는 플러그인

[![Version](https://img.shields.io/badge/version-2.0.0-6c63ff.svg?style=flat-square)](https://github.com/calmtiger86/non-dev-token-saver/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-f97316.svg?style=flat-square)](https://claude.ai/code)

**한국어 · [English](README.md)**

</div>

---

## 무엇을 하나요

non-dev-token-saver는 Claude Code 플러그인(기능을 덧붙이는 확장 묶음)이고, 기능은 두 가지입니다.

**1. 터미널 명령의 출력 줄이기 (rtk 필요).** Claude가 터미널 명령을 실행하기 직전에, 플러그인의 훅(정해진 시점에 자동으로 실행되는 작은 프로그램)이 [rtk](https://github.com/rtk-ai/rtk)에 그 명령을 물어봅니다. rtk가 출력을 줄여 줄 수 있는 명령이면 `rtk`를 앞에 붙인 명령으로 바꿔 실행합니다. 예를 들어 `git status`는 `rtk git status`로, `ls -la`는 `rtk ls -la`로 바뀝니다. 어떤 명령을 바꿀지는 rtk가 정하고, rtk가 없으면 아무 일도 하지 않습니다.

**2. 토큰 아끼는 습관 안내 (`token-habits` 스킬).** 스킬(필요할 때만 불려 나와 Claude에게 지침을 주는 문서)입니다. 토큰이나 비용이 걱정된다고 말하면 Claude가 이 안내를 읽고 알려 줍니다. 내용은 공식 문서에서 확인된 방법만 담았습니다.

- 서브에이전트(Claude가 일을 나눠 맡기는 보조 에이전트)에 더 싼 모델 쓰기
- `/usage`와 `/context`로 어디에 쓰이는지 확인하기
- 자동 compact(대화가 길어졌을 때 요약해 줄이는 기능) 시점 정하기
- rtk 설치하기

이 문서는 얼마나 절약되는지 수치를 약속하지 않습니다. 줄어드는 양은 작업마다 다르니, `/usage`로 직접 확인하세요.

---

## 설치

쓰는 곳에 맞는 방법 하나만 고르세요.

### Claude Code 안에서 (v2.1.275 이상)

```
/plugin install non-dev-token-saver --marketplace calmtiger86/non-dev-token-saver
```

### 터미널에서 (v2.1.292 이상)

```bash
claude plugin install non-dev-token-saver --marketplace calmtiger86/non-dev-token-saver
```

### Claude 데스크톱 앱

프롬프트 입력창 옆의 **+** 버튼을 누르고, **Add plugins**에서 마켓 `calmtiger86/non-dev-token-saver`를 추가한 뒤 non-dev-token-saver를 설치합니다.

> 설치한 뒤 기능이 보이지 않으면, 실행 중인 세션에서 `/reload-plugins`를 입력하거나 Claude Code를 다시 시작하세요.

### rtk 설치 (1번 기능에 필요)

```bash
brew install rtk          # Homebrew가 있다면
winget install rtk-ai.rtk # Windows
```

`cargo install rtk`는 쓰지 마세요. rtk 공식 안내가 경고하듯, crates.io의 `rtk`는 이름만 같은 다른 프로젝트입니다. 설치했는지는 `rtk --version`으로 확인합니다. 훅은 `rtk hook claude`라는 하위 명령을 부르므로, 이 명령이 없는 옛 rtk라면 명령이 바뀌지 않을 뿐 도구 호출은 막히지 않습니다. `rtk hook --help`로 확인할 수 있습니다.

---

## 알아 둘 점

- **Node.js와 jq는 필요 없습니다.** 훅은 `rtk hook claude; exit 0` 한 줄입니다. rtk가 없거나 이상하게 끝나도 훅은 정상 종료(0)로 끝나서 도구 호출을 막거나 오류 줄을 내지 않습니다.
- **승인 창.** rtk는 내가 정해 둔 허용 규칙을 보고 바꾼 명령을 자동 승인할지 정합니다. 금지(deny) 규칙에 걸리는 명령은 바꾸지 않고 그대로 통과시켜서, Claude Code의 금지 규칙이 그대로 적용됩니다.
- **`rtk init -g`를 이미 했다면.** rtk가 직접 다는 훅과 이 플러그인의 훅이 같은 일을 하므로 하나만 쓰는 편이 깔끔합니다. 스킬만 쓰고 싶다면 플러그인을 설치해도 됩니다.
- **확인한 환경.** macOS, Claude Code 2.1.325, rtk 0.44.2에서 훅 명령을 직접 돌려 확인했습니다. Windows는 PowerShell에서도 문법이 맞는 모양으로 썼지만 실제 Windows에서는 돌려 보지 못했습니다.

---

## 업데이트와 제거

### 업데이트

```bash
claude plugin update non-dev-token-saver@non-dev-token-saver
```

이미 실행 중인 세션에서는 `/reload-plugins`를 입력해야 새 버전이 적용됩니다.

### 제거

```bash
claude plugin uninstall non-dev-token-saver@non-dev-token-saver
```

2.0.0부터는 설정 폴더에 상태 파일이나 로그를 만들지 않으므로, 제거하면 남는 것이 없습니다.

---

## 1.x에서 옮기기

**마켓으로 설치했던 분.** 위의 업데이트 명령을 실행하면 됩니다. 1.x가 설정 폴더에 남긴 기록 폴더(`state`, `analytics`, `cache`, `logs` 아래의 `non-dev-token-saver`)는 업데이트로 지워지지 않으므로, 아래 정리 스크립트로 지울 수 있습니다.

**`install.js`로 설치했던 분.** `install.js`는 2.0.0에서 없어졌습니다. 위의 설치 방법으로 2.0.0을 설치한 뒤, 예전 설치가 남긴 흔적을 정리 스크립트로 지웁니다. [Node.js](https://nodejs.org)(18 이상)가 필요합니다.

```bash
git clone https://github.com/calmtiger86/non-dev-token-saver   # 이미 받아 둔 폴더가 있으면 그 안에서 git pull
cd non-dev-token-saver
node scripts/remove-legacy.mjs            # 미리보기: 아무것도 바꾸지 않고 지울 것만 보여 줍니다
node scripts/remove-legacy.mjs --apply    # 백업한 뒤 정리합니다
```

정리 스크립트가 하는 일은 다음과 같습니다.

- 설정 폴더(보통 `~/.claude`, `CLAUDE_CONFIG_DIR`을 쓰면 그 폴더)의 `settings.json`에서 `install.js`가 넣은 훅 항목만 뺍니다. 내가 직접 넣은 다른 설정은 그대로 둡니다.
- `install.js`가 복사해 둔 `plugins/non-dev-token-saver` 폴더와, 1.x 훅이 만든 `state`, `analytics`, `cache`, `logs` 아래의 `non-dev-token-saver` 폴더를 지웁니다.
- 지우기 전에 설정 폴더의 `backups` 폴더에 모두 백업합니다. 백업에는 예전 분석 기록과 캐시(프롬프트 원문 포함)가 들어 있으니, 필요 없으면 백업 폴더를 지워도 됩니다.
- `settings.json`을 읽지 못하면 `settings.json`과 옛 설치 폴더는 그대로 두고 알려 줍니다. 백업에 실패하면 아무것도 지우지 않습니다.

실행한 뒤에는 Claude Code를 다시 시작하세요.

---

## 2.0.0에서 빠진 것

1.x에서 약속한 기능 가운데 점검해 보니 약속대로 동작하지 않는 것을 뺐습니다.

| 빠진 기능 | 이유 |
|------|------|
| 모델 자동 변경 (haiku-router) | 프롬프트에 든 낱말 몇 개로 작업을 가려서, 로그인 기능 구현 같은 평범한 작업도 가장 작은 모델로 보내는 오분류가 확인되었습니다. 이제는 환경변수와 에이전트 정의로 직접 정하는 방법을 스킬이 안내합니다. |
| 같은 파일 다시 읽기 차단 | 훅 출력 형식이 맞지 않아 현재 Claude Code에서 차단은 적용되지 않고 오류 기록만 남았습니다. 형식을 고치면 긴 파일의 뒷부분과 PDF의 다음 쪽까지 막는 결함이 있었습니다. |
| 훅 결과 캐시 | 다른 호출의 입력을 덮어쓰는 결함이 있었고, 프롬프트 원문을 파일에 평문으로 남겼습니다. |
| 세션 분석(가계부) | 토큰 수를 한 번도 기록하지 못했습니다. 사용량은 `/usage`로 확인합니다. |
| `rules/` 폴더 | 플러그인의 `rules/` 폴더는 세션에 실리지 않아 Claude에게 닿지 않았습니다. 같은 내용을 필요할 때만 실리는 스킬로 옮겼습니다. |
| `install.js`, `install.sh`, `install.ps1` | 읽지 못한 `settings.json`을 통째로 덮어쓸 수 있었고, 마켓 설치와 함께 쓰면 훅이 두 번 돌았습니다. 설치는 마켓 하나로 줄였습니다. |
| "60배 저렴", "30~60% 절감" | 뒷받침하는 측정값이 없고 현재 가격표와도 맞지 않아 문서에서 지웠습니다. |

1.x 사용자가 느끼는 변화: 서브에이전트의 모델이 이 플러그인 때문에 바뀌는 일이 없어지고, 같은 파일을 다시 읽을 때의 오류 기록이 사라지며, 세션이 끝날 때 돌던 분석 훅도 없어집니다. 터미널 명령의 rtk 재작성은 그대로 남습니다.

---

## 파일 구조

```
non-dev-token-saver/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── hooks/
│   ├── hooks.json              ← rtk 재작성 훅 등록
│   └── hooks.test.mjs          ← 훅 명령 시험
├── skills/
│   └── token-habits/SKILL.md   ← 토큰 아끼는 습관 안내
└── scripts/
    ├── remove-legacy.mjs       ← 1.x 설치 흔적 정리
    └── remove-legacy.test.mjs  ← 정리 스크립트 시험
```

---

## 기여

버그 신고나 개선 제안은 언제든 환영합니다. 고친 뒤에는 저장소 폴더에서 아래 명령으로 점검합니다.

```bash
node hooks/hooks.test.mjs
node scripts/remove-legacy.test.mjs
claude plugin validate --strict .
```

**고친 내용을 배포하려면** `.claude-plugin/plugin.json`의 `version`과 `.claude-plugin/marketplace.json`의 `version` 두 곳(플러그인 항목과 맨 위)을 모두 같은 새 번호로 올려야 합니다. 번호가 그대로면 사용자가 업데이트해도 "이미 최신"이라고 나오고 새 내용을 받지 못합니다.

---

## 라이선스

MIT © [calmtiger86](https://github.com/calmtiger86)
