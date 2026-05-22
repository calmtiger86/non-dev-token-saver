<div align="center">

# non-dev-token-saver

### The plugin that stops Claude from overspending.

[![Version](https://img.shields.io/badge/version-1.0.0-6c63ff.svg?style=flat-square)](https://github.com/calmtiger86/non-dev-token-saver/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-f97316.svg?style=flat-square)](https://claude.ai/code)
[![Platform](https://img.shields.io/badge/platform-Mac%20%7C%20Linux%20%7C%20Windows-0ea5e9.svg?style=flat-square)](#installation)

**[한국어](README.ko.md) · English**

<br/>

> *If Claude Code feels expensive — if tokens feel scarce — there's a reason.*  
> *The most expensive model was doing the simple jobs, too.*

</div>

---

## The Problem

You ask Claude to summarize eight files. Simple job. But behind the scenes, an Opus subagent spins up — the most expensive model, at $15 per million tokens. That's 60 times more than Haiku, which could do the same job just fine.

Now multiply that by every read, every grep, every "explain this function." Tokens add up. Fast.

**non-dev-token-saver** steps in before the subagent launches. It looks at what the task actually is — thinking or carrying — and picks the right model. Automatically.

---

## After You Install

**You ask Claude to summarize some files:**

```
You:    "Summarize the key exports in these 8 files"

Before: Opus subagent wakes up. Reads all 8. Full price.

After:  The plugin sees "summarize" — that's carrying, not thinking.
        Swaps to Haiku. Same result. 60x cheaper.
```

**You read a config file. Then read it again two minutes later:**

```
Before: Both reads go through. Double the tokens.

After:  The plugin remembers: same file, same lines, nothing changed.
        Blocks the second read. Zero tokens.
```

**You ask Claude to debug a race condition:**

```
You:    "Debug the race condition in the auth middleware"

Before: Opus handles it.

After:  Opus handles it. Unchanged.
        The plugin saw "debug" and "race condition" — thinking words.
        It never downgrades thinking work. Never.
```

That's the whole point. **It knows the difference between carrying and thinking.** Carrying gets the cheaper model. Thinking keeps the expensive one. No exceptions.

---

## Five Layers, One Install

The plugin doesn't do one thing. It stacks five optimizations, each catching tokens the others miss.

**Layer 1 — Model routing.** I/O subagent tasks go to Haiku. Reasoning stays on Opus. A dual gate makes sure nothing important gets downgraded: the prompt must have no reasoning keywords *and* the task type must be classified as I/O. Both gates must pass.

**Layer 2 — Read deduplication.** If you already read a file and it hasn't changed, reading it again is waste. The plugin tracks what you've read (file, line range, modification time) and blocks duplicate reads within the session.

**Layer 3 — Command rewrite.** If [RTK](https://github.com/rtk-ai/rtk) is installed, Bash output gets compressed before it enters the conversation. Fewer output tokens per command.

**Layer 4 — Hook cache.** The routing decision itself takes computation. Once the plugin decides "this prompt pattern → Haiku," it caches that answer in memory and on disk. Next time, instant.

**Layer 5 — Analytics.** Every session gets logged — input tokens, output tokens, cache hits, duration. You can see exactly where your tokens went.

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

## Already Using oh-my-claudecode?

The installer detects OMC and gets out of the way. If OMC already provides a hook — haiku-router, read guard, RTK rewrite, cache cleanup — the plugin skips it. No duplicates, no conflicts.

The only thing that always installs is the analytics hook. It writes to its own log path, separate from OMC.

---

## Turning Things Off

Everything is on by default. If something gets in the way, one environment variable turns it off:

```bash
HAIKU_FIRST_DISABLED=true     # stop all model routing
TOKEN_OPTIMIZER_READ_GUARD_OFF=true  # stop blocking duplicate reads
TOKEN_OPTIMIZER_HAIKU_OFF=true       # stop injecting haiku specifically
```

You can also raise the token threshold for routing. Default is 2000 — tasks estimated below that skip delegation entirely because the overhead would cost more than the savings:

```bash
HAIKU_FIRST_THRESHOLD=3000
```

---

## Where the Logs Go

Session analytics land in `~/.claude/analytics/non-dev-token-saver/sessions.jsonl`. One JSON line per session — tokens in, tokens out, cache reads, duration, tool calls.

---

## File Structure

```
non-dev-token-saver/
├── hooks/
│   ├── hooks.json              ← auto-registers on install
│   ├── haiku-router.mjs        ← model routing
│   ├── read-guard.mjs          ← read deduplication
│   ├── rtk-rewrite.sh          ← command rewrite (needs RTK)
│   ├── read-cache-cleanup.mjs  ← session cleanup
│   ├── token-analytics.mjs     ← session analytics
│   └── lib/
│       ├── haiku-first.mjs     ← routing engine
│       ├── hook-cache.mjs      ← dual-layer cache
│       └── token-utils.mjs     ← token estimation
├── rules/
│   └── token-optimization.md   ← optimization guide
├── install.js                  ← cross-platform installer
├── install.sh                  ← Mac/Linux shortcut
└── install.ps1                 ← Windows shortcut
```

---

## Uninstall

```bash
rm -rf ~/.claude/plugins/non-dev-token-saver
```

Then open `~/.claude/settings.json` and delete the entries under `"hooks"` that mention `non-dev-token-saver`.

---

## License

MIT © [calmtiger86](https://github.com/calmtiger86)
