#!/usr/bin/env node

/**
 * Haiku-First Layer (standalone plugin version)
 *
 * Model routing: I/O tasks → haiku, reasoning → opus/sonnet.
 * Threshold: 2000 tokens (below = direct, overhead > savings).
 *
 * Self-contained: no qwer-config dependency.
 */

import { estimateTokens } from './token-utils.mjs';

export const TASK_CLASSIFICATION = {
  io: [
    'multi_file_read',
    'file_summarize',
    'boilerplate_draft',
    'doc_update_draft',
    'translation',
    'code_explain',
    'grep_analysis',
    'log_analysis',
    'diff_summary'
  ],
  reasoning: [
    'debug',
    'architecture',
    'security',
    'race_condition',
    'numerical_stability',
    'complex_refactor',
    'root_cause_analysis',
    'design_decision'
  ]
};

const DEFAULT_CONFIG = {
  enabled: true,
  tokenThreshold: 2000,
  multiFileThreshold: 3,
  modelCosts: {
    opus: 15.0,
    sonnet: 3.0,
    haiku: 0.25
  }
};

function isDisabled() {
  return process.env.HAIKU_FIRST_DISABLED === 'true';
}

function getThreshold() {
  const envThreshold = process.env.HAIKU_FIRST_THRESHOLD;
  if (envThreshold) {
    const parsed = parseInt(envThreshold, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return DEFAULT_CONFIG.tokenThreshold;
}

export function shouldDelegateToHaiku(task) {
  if (isDisabled()) {
    return { delegate: false, reason: 'env_disabled' };
  }

  if (!DEFAULT_CONFIG.enabled) {
    return { delegate: false, reason: 'config_disabled' };
  }

  const tokens = task.estimatedTokens || estimateTaskTokens(task);
  const threshold = getThreshold();

  if (tokens < threshold) {
    return {
      delegate: false,
      reason: 'below_threshold',
      tokens,
      threshold,
      recommendation: 'direct_processing'
    };
  }

  if (TASK_CLASSIFICATION.reasoning.includes(task.type)) {
    return {
      delegate: false,
      reason: 'reasoning_required',
      noDelegate: true,
      recommendation: 'use_opus'
    };
  }

  if (TASK_CLASSIFICATION.io.includes(task.type)) {
    const savingsRatio = Math.round(DEFAULT_CONFIG.modelCosts.opus / DEFAULT_CONFIG.modelCosts.haiku);
    const savings = Math.round(tokens * (1 - 1 / savingsRatio));
    return {
      delegate: true,
      model: 'haiku',
      reason: task.type,
      tokens,
      estimatedSavings: savings,
      savingsRatio
    };
  }

  const multiFileThreshold = DEFAULT_CONFIG.multiFileThreshold;
  if (task.files && task.files.length >= multiFileThreshold) {
    const savingsRatio = 60;
    const savings = Math.round(tokens * (1 - 1 / savingsRatio));
    return {
      delegate: true,
      model: 'haiku',
      reason: 'multi_file_heuristic',
      tokens,
      fileCount: task.files.length,
      estimatedSavings: savings,
      savingsRatio
    };
  }

  return {
    delegate: false,
    reason: 'not_classified',
    tokens,
    recommendation: 'use_sonnet'
  };
}

export function detectTaskType(task) {
  const content = (task.content || task.task || '').toLowerCase();
  const files = task.files || [];

  if (files.length >= 3) return 'multi_file_read';

  if (/요약|summarize|summary/i.test(content)) return 'file_summarize';
  if (/번역|translate|translation/i.test(content)) return 'translation';
  if (/설명|explain|description/i.test(content)) return 'code_explain';
  if (/테스트|test|spec/i.test(content) && /생성|create|generate|작성/i.test(content)) return 'boilerplate_draft';
  if (/문서|docs?|readme/i.test(content) && /업데이트|update|수정/i.test(content)) return 'doc_update_draft';
  if (/grep|검색|search.*결과|result/i.test(content)) return 'grep_analysis';
  if (/로그|log.*분석|analy/i.test(content)) return 'log_analysis';
  if (/diff|변경.*요약|change/i.test(content)) return 'diff_summary';

  if (/디버그|debug|버그.*찾|find.*bug/i.test(content)) return 'debug';
  if (/아키텍처|architecture|설계/i.test(content)) return 'architecture';
  if (/보안|security|취약|vulnerab/i.test(content)) return 'security';
  if (/race.*condition|동시성|concurren/i.test(content)) return 'race_condition';
  if (/리팩토링|refactor/i.test(content)) return 'complex_refactor';

  return 'unknown';
}

export function formatForHaikuSummary(files, question) {
  const corpus = files.map(f =>
    `<file path="${f.path}">\n${f.content}\n</file>`
  ).join('\n\n');

  const originalTokens = estimateTokens(corpus + question);

  const messages = [
    { role: 'user', content: `다음 파일들을 분석하세요:\n\n${corpus}` },
    { role: 'user', content: question }
  ];

  return {
    messages,
    originalTokens,
    fileCount: files.length,
    corpusTokens: estimateTokens(corpus)
  };
}

export function formatForBoilerplateDraft(spec, context) {
  const { referenceFiles = [], targetPath, type } = context;

  let corpus = '';
  if (referenceFiles.length > 0) {
    corpus = referenceFiles.map(f =>
      `<reference path="${f.path}">\n${f.content}\n</reference>`
    ).join('\n\n');
  }

  const prompt = `타입: ${type} (test | config | types | docs)
대상 파일: ${targetPath}
요구사항: ${spec}

위 참조 파일의 패턴을 따라 초안을 생성하세요.`;

  const messages = corpus
    ? [
        { role: 'user', content: corpus },
        { role: 'user', content: prompt }
      ]
    : [{ role: 'user', content: prompt }];

  return {
    messages,
    originalTokens: estimateTokens(corpus + prompt),
    type,
    targetPath
  };
}

function estimateTaskTokens(task) {
  let tokens = 0;
  if (task.content) tokens += estimateTokens(task.content);
  if (task.task) tokens += estimateTokens(task.task);
  if (task.files) {
    for (const file of task.files) {
      tokens += estimateTokens(file.content || '');
    }
  }
  return tokens;
}

export function calculateSavings(originalTokens, actualTokens, originalModel = 'opus', actualModel = 'haiku') {
  const costs = DEFAULT_CONFIG.modelCosts;
  const originalCost = (originalTokens / 1000000) * costs[originalModel];
  const actualCost = (actualTokens / 1000000) * costs[actualModel];

  return {
    tokensSaved: originalTokens - actualTokens,
    costSaved: Math.round((originalCost - actualCost) * 10000) / 10000,
    savingsRatio: actualTokens > 0 ? Math.round(originalTokens / actualTokens) : 1
  };
}

export function getModelRole(model) {
  const roles = {
    haiku: 'I/O worker: reads, summaries, drafts, repetitive tasks',
    sonnet: 'Developer: standard implementation, semantic verification',
    opus: 'Architect: reasoning, architecture, final review'
  };
  return roles[model] || 'Unknown';
}

export default {
  shouldDelegateToHaiku,
  detectTaskType,
  formatForHaikuSummary,
  formatForBoilerplateDraft,
  calculateSavings,
  getModelRole,
  TASK_CLASSIFICATION
};
