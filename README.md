<div align="center">

# non-dev-token-saver

### Stop burning tokens. Start routing them.

[![Version](https://img.shields.io/badge/version-1.0.0-6c63ff.svg?style=flat-square)](https://github.com/calmtiger86/non-dev-token-saver/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-f97316.svg?style=flat-square)](https://claude.ai/code)
[![Platform](https://img.shields.io/badge/platform-Mac%20%7C%20Linux%20%7C%20Windows-0ea5e9.svg?style=flat-square)](#installation)

**[한국어](README.ko.md) · English**

<br/>

> *Opus thinks. Haiku carries.*  
> *The right model for the right job — automatically.*

</div>

---

## The Problem

Claude Code is powerful. But every subagent call, every file re-read, every verbose grep — that's tokens. And tokens cost money.

| Model | Input cost | Ratio |
|-------|-----------|-------|
| Opus | $15 / 1M tokens | 60x |
| Sonnet | $3 / 1M tokens | 12x |
| **Haiku** | **$0.25 / 1M tokens** | **1x** |

Ask Claude to *"summarize these 5 files"* and it spins up an Opus subagent. That's like hiring an architect to carry boxes.

**non-dev-token-saver** fixes this. Automatically. Five layers deep.

---

## After You Install

**Scenario 1 — A summarization task:**

```
You:     "Summarize the key exports in these 8 files"

Without plugin:
  └── Opus subagent spawns → reads all 8 files → $$$

With plugin:
  └── haiku-router detects I/O task
      └── Injects model: 'haiku' → same result, 60x cheaper
```

**Scenario 2 — Reading the same file twice:**

```
You:     (reads config.json at line 1-50)
You:     (reads config.json at line 1-50 again, 2 minutes later)

Without plugin:
  └── Both reads go through → double the tokens

With plugin:
  └── read-guard checks mtime + range
      └── "Already in context" → second read blocked, zero tokens
```

**Scenario 3 — A debugging task:**

```
You:     "Debug the race condition in the auth middleware"

Without plugin:
  └── Same as with plugin — Opus handles it

With plugin:
  └── haiku-router detects reasoning keywords ("debug", "race condition")
      └── Passes through untouched — never downgrades thinking work
```

The key: **it knows the difference.**

---

## Five Layers

| Layer | What it does | How it saves |
|-------|-------------|-------------|
| 1. **Model routing** | Routes I/O subagents to haiku | 60x cheaper per routed call |
| 2. **Read dedup** | Blocks re-reads of unchanged files | Eliminates duplicate token consumption |
| 3. **Command rewrite** | Compresses Bash output via RTK | Fewer output tokens per command |
| 4. **Hook cache** | Caches routing decisions (memory + file) | Skips repeated classification |
| 5. **Analytics** | Logs per-session token usage | See where tokens go |

---

## Installation

### Option A — via `claude plugin` (recommended)

```bash
claude plugin marketplace add https://github.com/calmtiger86/non-dev-token-saver
claude plugin install non-dev-token-saver@non-dev-token-saver
```

Restart Claude Code. Done.

### Option B — via `omc install` (if you use oh-my-claudecode)

```bash
omc install https://github.com/calmtiger86/non-dev-token-saver
```

Restart Claude Code. Done.

### Option C — manual (works everywhere)

**Step 1** — Make sure [Node.js](https://nodejs.org) is installed (v18 or higher).  
Run `node --version` in a terminal. If a version number appears, you're ready.

**Step 2** — Clone this repository:

```bash
git clone https://github.com/calmtiger86/non-dev-token-saver
cd non-dev-token-saver
```

**Step 3** — Run the installer:

```bash
node install.js
```

**Step 4** — Restart Claude Code. Done.

> No npm install. No config files. No API keys.

---

## How Model Routing Works

```
Subagent call comes in
└── Is it Task or Agent?
    ├── No  → pass through
    └── Yes → classify subagent type
        ├── REASONING (architect, debugger, security-reviewer, ...)
        │   └── Never downgrade. Pass through.
        ├── IO_SAFE (explore, writer)
        │   └── Already handled by frontmatter. Pass through.
        └── GENERIC (general-purpose, executor)
            └── Dual gate check:
                ├── Gate 1: No reasoning keywords in prompt?
                ├── Gate 2: Task type is I/O? (summarize, translate, explain...)
                └── Both pass → inject model: 'haiku'
```

18 reasoning types are protected. Only generic I/O tasks get routed.

---

## OMC Compatibility

Already using [oh-my-claudecode](https://github.com/anthropics/oh-my-claudecode)? The installer auto-detects it and skips hooks OMC already provides:

| Hook | With OMC | Without OMC |
|------|----------|-------------|
| haiku-router | Skipped (OMC provides) | Registered |
| read-guard | Skipped (OMC context-tool-guard) | Registered |
| rtk-rewrite | Skipped (OMC provides) | Registered (if RTK installed) |
| read-cache-cleanup | Skipped (OMC provides) | Registered |
| **token-analytics** | **Always registered** | **Always registered** |

Analytics always runs — separate log path, no conflicts.

---

## Configuration

All features are on by default. Turn them off with environment variables:

| Variable | Default | What it does |
|----------|---------|-------------|
| `HAIKU_FIRST_DISABLED=true` | off | Disable all model routing |
| `HAIKU_FIRST_THRESHOLD=3000` | `2000` | Token threshold for haiku delegation |
| `TOKEN_OPTIMIZER_READ_GUARD_OFF=true` | off | Disable read deduplication |
| `TOKEN_OPTIMIZER_HAIKU_OFF=true` | off | Disable haiku injection only |

---

## Analytics

Session data is logged to `~/.claude/analytics/non-dev-token-saver/sessions.jsonl`:

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

Optional: [RTK](https://github.com/rtk-ai/rtk) for Layer 3. Install with `cargo install rtk`, then re-run `node install.js`.

---

## File Structure

```
non-dev-token-saver/
├── hooks/
│   ├── hooks.json              ← auto-registers on install
│   ├── haiku-router.mjs        ← Layer 1: model routing
│   ├── read-guard.mjs          ← Layer 2: read deduplication
│   ├── rtk-rewrite.sh          ← Layer 3: command rewrite (RTK)
│   ├── read-cache-cleanup.mjs  ← session cleanup
│   ├── token-analytics.mjs     ← Layer 5: session analytics
│   └── lib/
│       ├── haiku-first.mjs     ← routing engine
│       ├── hook-cache.mjs      ← Layer 4: dual-layer cache
│       └── token-utils.mjs     ← CJK-aware token estimation
├── rules/
│   └── token-optimization.md   ← optimization guide
├── install.js                  ← cross-platform installer
├── install.sh                  ← Mac/Linux shortcut
└── install.ps1                 ← Windows shortcut
```

---

## Uninstall

```bash
# Remove plugin files
rm -rf ~/.claude/plugins/non-dev-token-saver

# Open ~/.claude/settings.json and delete the entries
# under "hooks" that reference "non-dev-token-saver".
```

---

## License

MIT © [calmtiger86](https://github.com/calmtiger86)
