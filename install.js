#!/usr/bin/env node

/**
 * non-dev-token-saver installer — CommonJS (Node.js 18+, Mac/Linux/Windows)
 *
 * Run: node install.js
 *
 * Behavior:
 *   1. Detect OMC presence (skip hooks that OMC already provides)
 *   2. Copy plugin files to ~/.claude/plugins/non-dev-token-saver/
 *   3. Register hooks in ~/.claude/settings.json (with duplicate prevention)
 *   4. Detect RTK and provide guidance
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const SRC        = __dirname;
const HOME       = os.homedir();
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
const PLUGIN_DST = path.join(CLAUDE_DIR, 'plugins', 'non-dev-token-saver');
const SETTINGS   = path.join(CLAUDE_DIR, 'settings.json');

function log(msg) { console.log('  ' + msg); }
function ok(msg)  { console.log('  ✓ ' + msg); }
function warn(msg){ console.log('  ! ' + msg); }
function die(msg) { console.error('  ✗ ' + msg); process.exit(1); }

// ── 0. Detect OMC ──────────────────────────────────────────────────────────────

function detectOMC() {
  const omcDir = path.join(HOME, '.omc');
  const omcPlugin = path.join(CLAUDE_DIR, 'plugins', 'oh-my-claudecode');
  return fs.existsSync(omcDir) || fs.existsSync(omcPlugin);
}

function detectRTK() {
  try {
    require('child_process').execSync('command -v rtk', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const hasOMC = detectOMC();
const hasRTK = detectRTK();

console.log('');
console.log('non-dev-token-saver installer');
console.log('========================');
console.log('');

if (hasOMC) {
  log('OMC detected — will skip hooks already provided by OMC');
}

// ── 1. Copy files ──────────────────────────────────────────────────────────────

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const s = path.join(src, entry);
    const d = path.join(dst, entry);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

log('Copying plugin files...');
if (path.resolve(SRC) === path.resolve(PLUGIN_DST)) {
  ok('Already running from install location — skip copy');
} else {
  try {
    copyDir(SRC, PLUGIN_DST);
    ok('~/.claude/plugins/non-dev-token-saver/');
  } catch (e) {
    die('File copy failed: ' + e.message);
  }
}

// ── 2. Register hooks ──────────────────────────────────────────────────────────

log('Registering hooks in settings.json...');

var settings = {};
if (fs.existsSync(SETTINGS)) {
  try { settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf-8')); }
  catch (_) { settings = {}; }
}
if (!settings.hooks) settings.hooks = {};

var ROOT = PLUGIN_DST.replace(/\\/g, '/');

function hasCmd(entries, cmd) {
  return (entries || []).some(function(e) {
    return (e.hooks || []).some(function(h) { return h.command === cmd; });
  });
}

function addHook(event, cmd, extra) {
  if (!settings.hooks[event]) settings.hooks[event] = [];
  if (!hasCmd(settings.hooks[event], cmd)) {
    var hook = Object.assign({ type: 'command', command: cmd }, extra || {});
    settings.hooks[event].push({ hooks: [hook] });
    return true;
  }
  return false;
}

// Check if OMC already provides equivalent hooks
function omcHasHook(event, pattern) {
  if (!hasOMC) return false;
  var entries = settings.hooks[event] || [];
  return entries.some(function(e) {
    return (e.hooks || []).some(function(h) {
      return h.command && h.command.indexOf(pattern) !== -1;
    });
  });
}

var registered = [];
var skipped = [];

// haiku-router: skip if OMC haiku-router exists
var HAIKU_CMD = 'node "' + ROOT + '/hooks/haiku-router.mjs"';
if (omcHasHook('PreToolUse', 'haiku-router')) {
  skipped.push('haiku-router (OMC provides)');
} else {
  if (addHook('PreToolUse', HAIKU_CMD, { timeout: 5 })) registered.push('haiku-router');
  else skipped.push('haiku-router (already registered)');
}

// read-guard: skip if OMC context-tool-guard exists
var READ_GUARD_CMD = 'node "' + ROOT + '/hooks/read-guard.mjs"';
if (omcHasHook('PreToolUse', 'context-tool-guard')) {
  skipped.push('read-guard (OMC context-tool-guard provides)');
} else {
  if (addHook('PreToolUse', READ_GUARD_CMD, { timeout: 5 })) registered.push('read-guard');
  else skipped.push('read-guard (already registered)');
}

// rtk-rewrite: register if RTK present and no existing rtk hook
var RTK_CMD = 'bash "' + ROOT + '/hooks/rtk-rewrite.sh"';
if (hasRTK) {
  if (omcHasHook('PreToolUse', 'rtk-rewrite')) {
    skipped.push('rtk-rewrite (OMC provides)');
  } else {
    if (addHook('PreToolUse', RTK_CMD, { timeout: 5 })) registered.push('rtk-rewrite');
    else skipped.push('rtk-rewrite (already registered)');
  }
} else {
  skipped.push('rtk-rewrite (RTK not installed)');
}

// read-cache-cleanup: skip if OMC has it
var CLEANUP_CMD = 'node "' + ROOT + '/hooks/read-cache-cleanup.mjs"';
if (omcHasHook('SessionEnd', 'read-cache-cleanup')) {
  skipped.push('read-cache-cleanup (OMC provides)');
} else {
  if (addHook('SessionEnd', CLEANUP_CMD)) registered.push('read-cache-cleanup');
  else skipped.push('read-cache-cleanup (already registered)');
}

// token-analytics: always register (separate log path from OMC)
var ANALYTICS_CMD = 'node "' + ROOT + '/hooks/token-analytics.mjs"';
if (addHook('SessionEnd', ANALYTICS_CMD, { timeout: 10 })) registered.push('token-analytics');
else skipped.push('token-analytics (already registered)');

try {
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  registered.forEach(function(h) { ok(h + ' registered'); });
  skipped.forEach(function(h) { warn(h + ' — skipped'); });
} catch (e) {
  die('settings.json write failed: ' + e.message);
}

// ── 3. Summary ─────────────────────────────────────────────────────────────────

console.log('');
console.log('Installation complete! Restart Claude Code to activate.');
console.log('');

if (!hasRTK) {
  console.log('Optional: Install RTK for Bash command optimization');
  console.log('  cargo install rtk   (or see https://github.com/rtk-ai/rtk)');
  console.log('  Then re-run: node install.js');
  console.log('');
}

console.log('Environment variables:');
console.log('  HAIKU_FIRST_DISABLED=true         Disable model routing');
console.log('  HAIKU_FIRST_THRESHOLD=3000         Override token threshold');
console.log('  TOKEN_OPTIMIZER_READ_GUARD_OFF=true Disable read dedup');
console.log('  TOKEN_OPTIMIZER_HAIKU_OFF=true      Disable haiku injection');
console.log('');
console.log('Analytics: ~/.claude/analytics/non-dev-token-saver/sessions.jsonl');
