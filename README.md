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

**Scenario 1 — You ask Claude to summarize some files:**

```
You:     "Summarize the key exports in these 8 files"

Without plugin:
  └── Most expensive model wakes up → reads all 8 files → $$$

With plugin:
  └── Sees "summarize" — simple task
      └── Switches to cheaper model → same result, 60x less
```

**Scenario 2 — You read a config file. Then read it again two minutes later:**

```
You:     (reads config file, lines 1–50)
You:     (same file, same lines, 2 minutes later)

Without plugin:
  └── Both reads go through → double the tokens

With plugin:
  └── "You already read this, and it hasn't changed since"
      └── Second read blocked → zero tokens
```

**Scenario 3 — You ask Claude to fix a tricky bug:**

```
You:     "There's a concurrency bug in the login flow, find the cause"

Without plugin:
  └── Expensive model handles it

With plugin:
  └── Expensive model handles it. No change.
      "Bug", "cause" — those are thinking words.
      Thinking work never gets swapped to a cheaper model.
```

The point: **it tells simple tasks from hard ones.** Simple tasks get the cheaper model. Hard tasks keep the expensive one. Quality stays the same — only cost goes down.

---

## How It Works

Think of it like a company with a senior director and a sharp intern.

Until now, every task — photocopying, filing, summarizing meeting notes — went to the director. You were paying director-level salary for intern-level work.

This plugin looks at each incoming task and asks: "Does this need the director, or can the intern handle it?" It does this five ways.

**1 — Task assignment.** "Summarize this", "translate that", "explain this function" — simple tasks go to the cheaper model (the intern). "Find this bug", "review this architecture", "check for security holes" — those stay with the expensive model (the director). Two checkpoints must be passed before any switch happens, so important work never goes to the wrong desk.

**2 — No photocopying the same document twice.** If you already read a file and nothing changed since, the plugin says so and blocks the re-read. Same as not running the copier twice for the same page.

**3 — Executive summary instead of full report.** When a terminal command produces long output, only the essentials enter the conversation. A 100-page report becomes a 1-page brief. (Requires [RTK](https://github.com/rtk-ai/rtk))

**4 — Decisions get written down.** Once the plugin decides "this type of task → intern," it notes it down. When the same type of task comes in again, no deliberation — instant assignment.

**5 — Expense tracking.** Every session records how many tokens were spent. You can see exactly where the budget went.

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
