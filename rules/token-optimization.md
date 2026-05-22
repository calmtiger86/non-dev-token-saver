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

## RTK Command Rewrite

If [RTK](https://github.com/rtk-ai/rtk) is installed, Bash commands are automatically rewritten for token-compressed output. Requires `rtk >= 0.23.0` and `jq`.

## Prefix Caching

When sending multiple files to a subagent, order corpus first and question last. This enables Anthropic's prefix caching — repeated queries on the same file set save ~75%.

## Context Habits

- Use `offset`/`limit` for targeted reads instead of full files
- Run `/compact` at ~65% context usage
- Redirect large Bash output to files instead of inline
- Avoid reading the same file twice in one session
