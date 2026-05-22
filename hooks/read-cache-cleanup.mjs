#!/usr/bin/env node

/**
 * read-cache-cleanup.mjs — SessionEnd hook
 * Deletes Read re-read guard state for the ending session.
 */

import { unlinkSync } from 'node:fs';

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    const rawSid = data.session_id || data.sessionId || data.sessionid ||
                   process.env.CLAUDE_CODE_SESSION_ID || '';
    if (!rawSid) return;
    const sid = String(rawSid).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
    const path = `${process.env.HOME || '/tmp'}/.claude/state/non-dev-token-saver/read-cache/${sid}.json`;
    try { unlinkSync(path); } catch { /* file doesn't exist — ignore */ }
  } catch { /* fail-open */ }
});
