#!/usr/bin/env node

/**
 * Hook Cache Layer (standalone plugin version)
 *
 * Dual-layer cache (memory + file) with TTL to reduce hook cold-start overhead.
 * Path: ~/.claude/cache/non-dev-token-saver/hook-results.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const HOME = homedir();
const CACHE_DIR = join(HOME, '.claude', 'cache', 'non-dev-token-saver');
const HOOK_CACHE_PATH = join(CACHE_DIR, 'hook-results.json');

const CACHE_CONFIG = {
  maxEntries: 500,
  defaultTTL: 60000,
  cleanupInterval: 300000,
  ttlByType: {
    'PreToolUse:Bash': 30000,
    'PreToolUse:Read': 120000,
    'PreToolUse:Edit': 30000,
    'UserPromptSubmit': 10000,
    'SessionStart': 300000,
  }
};

let memoryCache = new Map();
let lastCleanup = Date.now();

export function generateCacheKey(hookType, toolName, toolInput) {
  const inputStr = typeof toolInput === 'string'
    ? toolInput
    : JSON.stringify(toolInput || {});

  const hash = createHash('md5')
    .update(`${hookType}:${toolName}:${inputStr}`)
    .digest('hex')
    .slice(0, 16);

  return `${hookType}:${toolName}:${hash}`;
}

function getTTL(hookType, toolName) {
  const key = `${hookType}:${toolName}`;
  return CACHE_CONFIG.ttlByType[key] || CACHE_CONFIG.defaultTTL;
}

function loadFileCache() {
  try {
    if (existsSync(HOOK_CACHE_PATH)) {
      const data = JSON.parse(readFileSync(HOOK_CACHE_PATH, 'utf-8'));
      return new Map(Object.entries(data));
    }
  } catch {
    // Ignore cache read errors
  }
  return new Map();
}

function saveFileCache(cache) {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    const obj = Object.fromEntries(cache);
    writeFileSync(HOOK_CACHE_PATH, JSON.stringify(obj), 'utf-8');
  } catch {
    // Ignore cache write errors
  }
}

function cleanup(cache) {
  const now = Date.now();
  if (now - lastCleanup < CACHE_CONFIG.cleanupInterval) return cache;

  lastCleanup = now;

  for (const [key, entry] of cache) {
    if (entry.expiresAt < now) cache.delete(key);
  }

  if (cache.size > CACHE_CONFIG.maxEntries) {
    const entries = [...cache.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toRemove = cache.size - CACHE_CONFIG.maxEntries;
    for (let i = 0; i < toRemove; i++) {
      cache.delete(entries[i][0]);
    }
  }

  saveFileCache(cache);
  return cache;
}

export function getCached(hookType, toolName, toolInput) {
  const key = generateCacheKey(hookType, toolName, toolInput);
  const now = Date.now();

  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key);
    if (entry.expiresAt > now) return { hit: true, result: entry.result };
    memoryCache.delete(key);
  }

  const fileCache = loadFileCache();
  if (fileCache.has(key)) {
    const entry = fileCache.get(key);
    if (entry.expiresAt > now) {
      memoryCache.set(key, entry);
      return { hit: true, result: entry.result };
    }
  }

  return { hit: false };
}

export function setCached(hookType, toolName, toolInput, result) {
  const key = generateCacheKey(hookType, toolName, toolInput);
  const ttl = getTTL(hookType, toolName);
  const now = Date.now();

  const entry = {
    result,
    createdAt: now,
    expiresAt: now + ttl,
    hookType,
    toolName
  };

  memoryCache.set(key, entry);

  try {
    const fileCache = cleanup(loadFileCache());
    fileCache.set(key, entry);
    saveFileCache(fileCache);
  } catch {
    // Ignore errors
  }

  return entry;
}

export function invalidate(pattern) {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

  for (const key of memoryCache.keys()) {
    if (regex.test(key)) memoryCache.delete(key);
  }

  try {
    const fileCache = loadFileCache();
    for (const key of fileCache.keys()) {
      if (regex.test(key)) fileCache.delete(key);
    }
    saveFileCache(fileCache);
  } catch {
    // Ignore errors
  }
}

export function clearAll() {
  memoryCache.clear();
  try {
    if (existsSync(HOOK_CACHE_PATH)) {
      writeFileSync(HOOK_CACHE_PATH, '{}', 'utf-8');
    }
  } catch {
    // Ignore errors
  }
}

export function getStats() {
  const fileCache = loadFileCache();
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;

  for (const entry of fileCache.values()) {
    if (entry.expiresAt > now) validEntries++;
    else expiredEntries++;
  }

  return {
    memorySize: memoryCache.size,
    fileSize: fileCache.size,
    validEntries,
    expiredEntries,
    maxEntries: CACHE_CONFIG.maxEntries
  };
}

export default {
  getCached,
  setCached,
  invalidate,
  clearAll,
  getStats,
  generateCacheKey
};
