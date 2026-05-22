#!/usr/bin/env node

/**
 * token-analytics.mjs — SessionEnd hook
 *
 * Logs session token usage to ~/.claude/analytics/non-dev-token-saver/sessions.jsonl.
 * Works with or without OMC (.session-stats.json is optional).
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const input = JSON.parse(readFileSync(0, 'utf8'));

function readLatestSessionStats() {
  try {
    const statsPath = join(homedir(), '.claude', '.session-stats.json');
    const data = JSON.parse(readFileSync(statsPath, 'utf8'));
    const sessions = data.sessions || {};
    let latest = null;
    for (const [id, s] of Object.entries(sessions)) {
      if (!latest || (s.updated_at || 0) > (latest.updated_at || 0)) {
        latest = { ...s, id };
      }
    }
    return latest;
  } catch {
    return null;
  }
}

const liveSession = readLatestSessionStats();

const sessionStats = {
  timestamp: new Date().toISOString(),
  inputTokens: input.total_input_tokens ?? null,
  outputTokens: input.total_output_tokens ?? null,
  cacheCreation: input.total_cache_creation_input_tokens ?? null,
  cacheRead: input.total_cache_read_input_tokens ?? null,
  duration: liveSession?.started_at
    ? Math.round((Date.now() / 1000 - liveSession.started_at) * 1000)
    : null,
  toolCalls: liveSession?.total_calls ?? null,
  topTools: liveSession?.tool_counts ?? null,
  sessionId: liveSession?.id ?? null
};

const totalTokens = (sessionStats.inputTokens ?? 0) + (sessionStats.outputTokens ?? 0);
const cacheHitRate = (sessionStats.inputTokens ?? 0) > 0 && sessionStats.cacheRead != null
  ? ((sessionStats.cacheRead / sessionStats.inputTokens) * 100).toFixed(1)
  : null;

const logDir = join(homedir(), '.claude', 'analytics', 'non-dev-token-saver');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

const logFile = join(logDir, 'sessions.jsonl');
try {
  appendFileSync(logFile, JSON.stringify(sessionStats) + '\n');
} catch {
  // Logging failure is non-fatal
}

const output = { continue: true };

const hasRealToolCalls = (sessionStats.toolCalls ?? 0) > 5;
const hasRealTokens = totalTokens > 10000;
if (hasRealToolCalls || hasRealTokens) {
  const durationMin = sessionStats.duration != null
    ? (sessionStats.duration / 60000).toFixed(1)
    : '?';
  const cacheStr = cacheHitRate != null
    ? `${cacheHitRate}%`
    : 'N/A';
  const tokenStr = sessionStats.inputTokens != null
    ? `in: ${(sessionStats.inputTokens / 1000).toFixed(1)}K | out: ${(sessionStats.outputTokens / 1000).toFixed(1)}K`
    : 'tokens: not collected';

  output.systemMessage = `[non-dev-token-saver] ${tokenStr} | cache: ${cacheStr} | ${durationMin}min | tools: ${sessionStats.toolCalls ?? '?'}`;
}

console.log(JSON.stringify(output));
