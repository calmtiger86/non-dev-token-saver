# non-dev-token-saver

5-layer token optimization plugin for Claude Code. Saves 30-60% on token costs through automatic model routing, read deduplication, command rewriting, hook caching, and session analytics.

## Layers

| Layer | Hook | What it does |
|-------|------|-------------|
| 1. Model routing | `haiku-router.mjs` | I/O subagent tasks → haiku (60x cheaper than opus) |
| 2. Read dedup | `read-guard.mjs` | Prevents re-reading unchanged files within a session |
| 3. Command rewrite | `rtk-rewrite.sh` | Rewrites Bash commands via RTK for compressed output |
| 4. Hook cache | `hook-cache.mjs` | Dual-layer (memory + file) cache with TTL |
| 5. Analytics | `token-analytics.mjs` | Logs session token usage for tracking savings |

## Install

```bash
node install.js
```

The installer:
- Copies plugin files to `~/.claude/plugins/non-dev-token-saver/`
- Registers hooks in `~/.claude/settings.json`
- Auto-detects OMC (oh-my-claudecode) and skips duplicate hooks
- Auto-detects RTK and registers the rewrite hook if available

## Requirements

- Node.js 18+
- Claude Code CLI
- Optional: [RTK](https://github.com/rtk-ai/rtk) >= 0.23.0 + `jq` for command rewriting

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HAIKU_FIRST_DISABLED` | `false` | Disable model routing entirely |
| `HAIKU_FIRST_THRESHOLD` | `2000` | Token threshold for haiku delegation |
| `TOKEN_OPTIMIZER_READ_GUARD_OFF` | `false` | Disable read deduplication |
| `TOKEN_OPTIMIZER_HAIKU_OFF` | `false` | Disable haiku injection in router |

## How model routing works

The haiku-router classifies subagent types into 3 tiers:

- **REASONING** (analyst, architect, debugger, etc.) — never downgraded
- **IO_SAFE** (explore, writer) — already handled by frontmatter
- **GENERIC** (general-purpose, executor) — dual gate check:
  1. No reasoning keywords in prompt
  2. Task type detected as I/O (summarize, translate, explain, etc.)

Only when both gates pass does the router inject `model: 'haiku'`.

## OMC Compatibility

Works alongside oh-my-claudecode. The installer detects OMC and skips registering hooks that OMC already provides (haiku-router, context-tool-guard, read-cache-cleanup, rtk-rewrite). Analytics always registers with a separate log path.

## Analytics

Session data is logged to `~/.claude/analytics/non-dev-token-saver/sessions.jsonl` in JSONL format:

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

## License

MIT
