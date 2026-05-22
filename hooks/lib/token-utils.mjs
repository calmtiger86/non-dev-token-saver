#!/usr/bin/env node

/**
 * Token estimation with CJK awareness.
 * Extracted from context-compressor.mjs for standalone use.
 */

const CHARS_PER_TOKEN_ASCII = 4;
const CHARS_PER_TOKEN_CJK = 1.5;
const CJK_REGEX = /[　-鿿가-힯＀-￯]/g;

export function estimateTokens(text) {
  if (!text) return 0;
  if (typeof text !== 'string') text = JSON.stringify(text);
  const cjkMatches = text.match(CJK_REGEX);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const asciiCount = text.length - cjkCount;
  return Math.ceil(cjkCount / CHARS_PER_TOKEN_CJK) + Math.ceil(asciiCount / CHARS_PER_TOKEN_ASCII);
}

export default { estimateTokens };
