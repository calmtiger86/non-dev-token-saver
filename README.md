<div align="center">

# non-dev-token-saver

### A plugin that helps you look at where your Claude Code tokens go.

[![Version](https://img.shields.io/badge/version-2.0.0-6c63ff.svg?style=flat-square)](https://github.com/calmtiger86/non-dev-token-saver/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-f97316.svg?style=flat-square)](https://claude.ai/code)

**[한국어](README.ko.md) · English**

</div>

---

## What It Does

non-dev-token-saver is a Claude Code plugin with two features.

**1. Shorter terminal command output (needs rtk).** Right before Claude runs a terminal command, the plugin's hook (a small program that runs automatically at a set moment) asks [rtk](https://github.com/rtk-ai/rtk) about that command. If rtk can shorten its output, the command runs with `rtk` in front. For example, `git status` becomes `rtk git status` and `ls -la` becomes `rtk ls -la`. rtk decides which commands change, and without rtk the hook does nothing.

**2. Token-saving habits (the `token-habits` skill).** A skill is a document that is loaded only when needed and gives Claude instructions. Say you are worried about tokens or cost and Claude reads this guide and walks you through it. It contains only methods confirmed in the official Claude Code documentation:

- Running subagents (helper agents Claude hands work to) on a cheaper model
- Checking where usage goes with `/usage` and `/context`
- Choosing when auto-compact (summarizing a long conversation to shrink it) kicks in
- Installing rtk

This document makes no promise about how much you will save. The amount depends on the work, so check it yourself with `/usage`.

---

## Installation

Pick the one method that fits where you work.

### Inside Claude Code (v2.1.275 or later)

```
/plugin install non-dev-token-saver --marketplace calmtiger86/non-dev-token-saver
```

### From the terminal (v2.1.292 or later)

```bash
claude plugin install non-dev-token-saver --marketplace calmtiger86/non-dev-token-saver
```

### Claude desktop app

Click the **+** button next to the prompt box, add the marketplace `calmtiger86/non-dev-token-saver` under **Add plugins**, then install non-dev-token-saver.

> If the features don't show up after installing, type `/reload-plugins` in the running session or restart Claude Code.

### Installing rtk (needed for feature 1)

```bash
brew install rtk          # if you have Homebrew
winget install rtk-ai.rtk # Windows
```

Do not use `cargo install rtk`. As the rtk project itself warns, `rtk` on crates.io is a different project with the same name. Check the install with `rtk --version`. The hook calls the subcommand `rtk hook claude`; with an older rtk that lacks it, commands simply stay unchanged and tool calls are not blocked. You can check with `rtk hook --help`.

---

## Good to Know

- **No Node.js or jq needed.** The hook is a single line, `rtk hook claude; exit 0`. Whether rtk is missing or exits strangely, the hook ends with a normal exit (0), so it never blocks a tool call or prints an error line.
- **Approval prompts.** rtk looks at your own allow rules to decide whether a rewritten command is auto-approved. A command that matches a deny rule is passed through unchanged, so Claude Code's deny rules apply as before.
- **If you already ran `rtk init -g`.** The hook rtk installs itself does the same job as this plugin's hook, so using just one is cleaner. You can still install the plugin for the skill alone.
- **What was checked.** The hook command was run directly on macOS with Claude Code 2.1.325 and rtk 0.44.2. On Windows it is written in a form that is valid PowerShell syntax too, but it has not been run on a real Windows machine.

---

## Updating and Uninstalling

### Update

```bash
claude plugin update non-dev-token-saver@non-dev-token-saver
```

In a session that is already running, type `/reload-plugins` to apply the new version.

### Uninstall

```bash
claude plugin uninstall non-dev-token-saver@non-dev-token-saver
```

Since 2.0.0 the plugin creates no state files or logs in your config folder, so nothing is left behind after uninstalling.

---

## Moving from 1.x

**If you installed from the marketplace.** Run the update command above. The record folders 1.x left in your config folder (`non-dev-token-saver` under `state`, `analytics`, `cache`, and `logs`) are not removed by an update; the cleanup script below can remove them.

**If you installed with `install.js`.** `install.js` is gone in 2.0.0. Install 2.0.0 with one of the methods above, then remove the traces the old install left using the cleanup script. You need [Node.js](https://nodejs.org) (18 or later).

```bash
git clone https://github.com/calmtiger86/non-dev-token-saver   # if you already have the folder, run git pull inside it
cd non-dev-token-saver
node scripts/remove-legacy.mjs            # preview: changes nothing, only shows what would be removed
node scripts/remove-legacy.mjs --apply    # backs up, then cleans up
```

What the cleanup script does:

- Removes only the hook entries `install.js` added to `settings.json` in your config folder (usually `~/.claude`, or the folder in `CLAUDE_CONFIG_DIR` if you use it). Your other settings stay as they are.
- Deletes the `plugins/non-dev-token-saver` folder `install.js` copied, and the `non-dev-token-saver` folders the 1.x hooks created under `state`, `analytics`, `cache`, and `logs`.
- Backs everything up into the `backups` folder of your config folder before deleting. The backup contains the old analytics records and cache (including prompt text), so you can delete the backup folder if you don't need it.
- If it cannot read `settings.json`, it leaves `settings.json` and the old install folder alone and tells you. If the backup fails, it deletes nothing.

Restart Claude Code afterwards.

---

## What Was Removed in 2.0.0

Features from 1.x that did not work as promised when checked were removed.

| Removed | Why |
|------|------|
| Automatic model switching (haiku-router) | It judged tasks by a few words in the prompt, and a misclassification was reproduced that sent ordinary work, such as implementing a login feature, to the smallest model. The skill now explains how to choose models yourself with an environment variable and agent definitions. |
| Blocking repeated reads of the same file | Its hook output was malformed, so in current Claude Code the block was not applied and only error records appeared. Fixing the format would have blocked the later part of long files and later PDF pages. |
| Hook result cache | It could overwrite another call's input and stored prompt text in a plain file. |
| Session analytics (the ledger) | It never recorded a single token count. Check usage with `/usage`. |
| `rules/` folder | A plugin's `rules/` folder is not loaded into the session, so it never reached Claude. The same guidance moved into a skill that loads only when needed. |
| `install.js`, `install.sh`, `install.ps1` | They could overwrite an unreadable `settings.json` entirely, and used together with the marketplace install they ran every hook twice. Installation is now the marketplace only. |
| "60x cheaper", "saves 30-60%" | There were no measurements behind them and they did not match current pricing, so they were deleted. |

What 1.x users will notice: this plugin no longer changes your subagents' model, the error records for re-reading a file are gone, and the analytics hook that ran at session end is gone. The rtk rewrite of terminal commands stays.

---

## File Structure

```
non-dev-token-saver/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── hooks/
│   ├── hooks.json              ← registers the rtk rewrite hook
│   └── hooks.test.mjs          ← tests the hook command
├── skills/
│   └── token-habits/SKILL.md   ← token-saving habits guide
└── scripts/
    ├── remove-legacy.mjs       ← cleans up 1.x install traces
    └── remove-legacy.test.mjs  ← tests the cleanup script
```

---

## Contributing

Bug reports and suggestions are always welcome. After a change, check it from the repository folder:

```bash
node hooks/hooks.test.mjs
node scripts/remove-legacy.test.mjs
claude plugin validate --strict .
```

**To release a change,** raise `version` in `.claude-plugin/plugin.json` and both `version` fields in `.claude-plugin/marketplace.json` (the plugin entry and the top level) to the same new number. If the number stays the same, users who update are told they are "already up to date" and do not receive the change.

---

## License

MIT © [calmtiger86](https://github.com/calmtiger86)
