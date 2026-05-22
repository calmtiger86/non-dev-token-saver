#!/usr/bin/env node

/**
 * read-guard.mjs — PreToolUse hook for Read/Write/Edit
 *
 * Session-based mtime tracking with range coverage:
 * - Read: deny if same content already in context (lossless deny)
 * - Write/Edit: record last_write_ts for write-confirm bypass
 * - Large file warning (8KB+ without offset/limit)
 *
 * State: ~/.claude/state/non-dev-token-saver/read-cache/<session_id>.json
 * Kill switch: TOKEN_OPTIMIZER_READ_GUARD_OFF=true
 */

import { statSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

function isRangeCovered(reads, newStart, newEnd) {
  for (const r of reads) {
    if (r.start <= newStart) {
      if (r.end === null) return true;
      if (newEnd !== null && r.end >= newEnd) return true;
    }
  }
  return false;
}

function mergeRanges(reads, newStart, newEnd) {
  const all = [...reads, { start: newStart, end: newEnd }];
  all.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of all) {
    if (!merged.length) { merged.push({ start: r.start, end: r.end }); continue; }
    const last = merged[merged.length - 1];
    const lastEndNum = last.end === null ? Infinity : last.end;
    if (r.start <= lastEndNum + 1) {
      last.end = (last.end === null || r.end === null) ? null : Math.max(last.end, r.end);
    } else {
      merged.push({ start: r.start, end: r.end });
    }
  }
  return merged.slice(0, 20);
}

function readStdin(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; process.stdin.removeAllListeners(); resolve(Buffer.concat(chunks).toString('utf-8')); }
    }, timeoutMs);
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => { if (!settled) { settled = true; clearTimeout(timeout); resolve(Buffer.concat(chunks).toString('utf-8')); } });
    process.stdin.on('error', () => { if (!settled) { settled = true; clearTimeout(timeout); resolve(''); } });
  });
}

async function main() {
  try {
    if (process.env.TOKEN_OPTIMIZER_READ_GUARD_OFF === 'true') {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const raw = await readStdin();
    if (!raw.trim()) { console.log(JSON.stringify({ continue: true })); return; }

    const data = JSON.parse(raw);
    const toolName = data.tool_name || data.toolName || '';
    const toolInput = data.tool_input || data.toolInput || {};

    if (toolName !== 'Read' && toolName !== 'Write' && toolName !== 'Edit') {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const HOME = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const cacheDir = `${HOME}/.claude/state/non-dev-token-saver/read-cache`;
    const rawSid = data.session_id || data.sessionId || data.sessionid ||
                   process.env.CLAUDE_CODE_SESSION_ID || 'default';
    const sessionId = String(rawSid).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
    const stateFile = `${cacheDir}/${sessionId}.json`;

    // Write/Edit: record last_write_ts
    if ((toolName === 'Write' || toolName === 'Edit') && toolInput.file_path) {
      try {
        let state = {};
        try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch {}
        const entry = state[toolInput.file_path] || {};
        entry.last_write_ts = Date.now();
        state[toolInput.file_path] = entry;
        try { mkdirSync(cacheDir, { recursive: true }); } catch {}
        try { writeFileSync(stateFile, JSON.stringify(state)); } catch {}
      } catch { /* fail-open */ }
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Read guard
    if (toolName === 'Read' && toolInput.file_path) {
      let fileStat;
      try { fileStat = statSync(toolInput.file_path); } catch { /* file doesn't exist */ }

      if (fileStat) {
        const mtime = fileStat.mtimeMs;
        const sizeKb = Math.round(fileStat.size / 102.4) / 10;

        let state = {};
        try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch {}

        const entry = state[toolInput.file_path];
        const newStart = toolInput.offset || 0;
        const newEnd = toolInput.limit != null ? newStart + toolInput.limit : null;

        if (entry && entry.mtime === mtime) {
          const writeBypass = entry.last_write_ts != null && entry.last_read_ts != null &&
                              entry.last_write_ts > entry.last_read_ts;

          if (!writeBypass && isRangeCovered(entry.reads || [], newStart, newEnd)) {
            console.log(JSON.stringify({
              hookSpecificOutput: {
                permissionDecision: 'deny',
                permissionDecisionReason:
                  'Already read this content in current session (file unchanged). ' +
                  'Use context or specify different offset/limit.',
              },
            }));
            return;
          }

          entry.reads = mergeRanges(entry.reads || [], newStart, newEnd);
          entry.last_read_ts = Date.now();
          state[toolInput.file_path] = entry;
        } else {
          const isChanged = !!entry && entry.mtime !== mtime;
          state[toolInput.file_path] = {
            mtime,
            size_kb: sizeKb,
            reads: [{ start: newStart, end: newEnd }],
            last_read_ts: Date.now(),
            last_write_ts: entry?.last_write_ts ?? null,
          };

          if (!isChanged && sizeKb >= 8 && toolInput.limit == null && toolInput.offset == null) {
            const tokens = Math.round(sizeKb * 256);
            const ctxPct = Math.round(tokens / 200000 * 100);
            try { mkdirSync(cacheDir, { recursive: true }); } catch {}
            try { writeFileSync(stateFile, JSON.stringify(state)); } catch {}
            console.log(JSON.stringify({
              continue: true,
              additionalContext:
                `\n<system-reminder>\nLarge first read: ${sizeKb}KB (~${tokens} tokens, ~${ctxPct}% of main context). ` +
                'Consider using offset/limit for targeted reading, or delegate to a subagent for summarization.' +
                '\n</system-reminder>\n',
            }));
            return;
          }
        }

        try { mkdirSync(cacheDir, { recursive: true }); } catch {}
        try { writeFileSync(stateFile, JSON.stringify(state)); } catch {}
      }
    }

    console.log(JSON.stringify({ continue: true }));
  } catch {
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
