#!/usr/bin/env node

/**
 * haiku-router.mjs — PreToolUse hook for Task/Agent
 *
 * Routes subagent model based on 3-tier classification:
 *   REASONING — never downgrade (analyst, architect, code-reviewer, ...)
 *   IO_SAFE   — frontmatter handles (explore, writer)
 *   GENERIC   — dual gate → haiku inject (general-purpose, executor)
 *
 * Kill switches: HAIKU_FIRST_DISABLED=true, TOKEN_OPTIMIZER_HAIKU_OFF=true
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getCached, setCached } from './lib/hook-cache.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HOME = process.env.HOME || process.env.USERPROFILE || '/tmp';
const LOG_PATH = `${HOME}/.claude/logs/non-dev-token-saver/haiku-router.jsonl`;

const REASONING_TIER = new Set([
  'analyst', 'architect', 'code-reviewer', 'code-simplifier', 'critic',
  'planner', 'security-reviewer', 'debugger', 'designer', 'document-specialist',
  'git-master', 'qa-tester', 'scientist', 'test-engineer', 'tracer', 'verifier',
  'tdd-guide', 'code-guide',
]);

const IO_SAFE_TIER = new Set(['explore', 'writer']);
const GENERIC_TIER = new Set(['general-purpose', 'executor']);

const REASONING_KEYWORDS = /디버그|debug|버그|bug|보안|security|취약|vulnerab|리뷰|review|분석|analyz|analysis|race|deadlock|memory.?leak|아키텍처|architecture|설계|design|최적화|optim|root.?cause|근본.?원인|concurren|동시성|incident/i;

function writeLog(entry) {
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n');
  } catch { /* fail-open */ }
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
    const raw = await readStdin();
    if (!raw.trim()) { console.log(JSON.stringify({ continue: true })); return; }

    const data = JSON.parse(raw);
    const toolName = data.tool_name || data.toolName || '';
    const toolInput = data.tool_input || data.toolInput || {};

    if (process.env.HAIKU_FIRST_DISABLED === 'true' || process.env.TOKEN_OPTIMIZER_HAIKU_OFF === 'true') {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const toolNameLower = toolName.toLowerCase();
    if (toolNameLower !== 'task' && toolNameLower !== 'agent') {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const prompt = toolInput.prompt || toolInput.description || '';
    const rawSubagentType = toolInput.subagent_type || toolInput.subagentType || '';

    if (toolInput.model) {
      writeLog({ tool_name: toolName, subagent_type: rawSubagentType, action: 'no-op', reason: 'explicit_model_honored', model: toolInput.model });
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const subagentType = rawSubagentType.replace(/^oh-my-claudecode:/, '').replace(/^claude-code-guide:/, '');

    // Layer 4: check cache before expensive classification
    const cached = getCached('PreToolUse', toolName, { subagentType, prompt });
    if (cached.hit) {
      writeLog({ tool_name: toolName, subagent_type: subagentType, action: cached.result.action, reason: 'cache_hit' });
      console.log(JSON.stringify(cached.result.output));
      return;
    }

    if (REASONING_TIER.has(subagentType)) {
      const output = { continue: true };
      setCached('PreToolUse', toolName, { subagentType, prompt }, { action: 'no-op', output });
      writeLog({ tool_name: toolName, subagent_type: subagentType, action: 'no-op', reason: 'reasoning_tier' });
      console.log(JSON.stringify(output));
      return;
    }

    if (IO_SAFE_TIER.has(subagentType)) {
      const output = { continue: true };
      setCached('PreToolUse', toolName, { subagentType, prompt }, { action: 'no-op', output });
      writeLog({ tool_name: toolName, subagent_type: subagentType, action: 'no-op', reason: 'io_safe_tier' });
      console.log(JSON.stringify(output));
      return;
    }

    if (!GENERIC_TIER.has(subagentType)) {
      const output = { continue: true };
      setCached('PreToolUse', toolName, { subagentType, prompt }, { action: 'no-op', output });
      writeLog({ tool_name: toolName, subagent_type: subagentType, action: 'no-op', reason: 'unknown_type_conservative' });
      console.log(JSON.stringify(output));
      return;
    }

    if (REASONING_KEYWORDS.test(prompt)) {
      const output = { continue: true };
      setCached('PreToolUse', toolName, { subagentType, prompt }, { action: 'no-op', output });
      writeLog({ tool_name: toolName, subagent_type: subagentType, action: 'no-op', reason: 'reasoning_keyword_gate', prompt_head: prompt.slice(0, 80) });
      console.log(JSON.stringify(output));
      return;
    }

    let haikuModule = null;
    try {
      haikuModule = await import(pathToFileURL(join(__dirname, 'lib', 'haiku-first.mjs')).href);
    } catch {
      writeLog({ tool_name: toolName, subagent_type: subagentType, action: 'no-op', reason: 'haiku_first_load_failed' });
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const { detectTaskType, TASK_CLASSIFICATION } = haikuModule;
    const taskType = detectTaskType({ content: prompt });
    const isIoTask = taskType && taskType !== 'unknown' &&
                     Array.isArray(TASK_CLASSIFICATION?.io) &&
                     TASK_CLASSIFICATION.io.includes(taskType);

    if (!isIoTask) {
      const output = { continue: true };
      setCached('PreToolUse', toolName, { subagentType, prompt }, { action: 'no-op', output });
      writeLog({ tool_name: toolName, subagent_type: subagentType, action: 'no-op', reason: 'not_io_task', task_type: taskType, prompt_head: prompt.slice(0, 80) });
      console.log(JSON.stringify(output));
      return;
    }

    const updatedInput = { ...toolInput, model: 'haiku' };
    const output = { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput } };
    setCached('PreToolUse', toolName, { subagentType, prompt }, { action: 'inject_haiku', output });
    writeLog({ tool_name: toolName, subagent_type: subagentType, action: 'inject_haiku', task_type: taskType, prompt_head: prompt.slice(0, 80) });

    console.log(JSON.stringify(output));

  } catch {
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
