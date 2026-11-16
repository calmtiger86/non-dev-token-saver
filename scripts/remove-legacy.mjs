#!/usr/bin/env node
// 예전 버전(1.x)이 설정 폴더에 남긴 non-dev-token-saver 흔적을 정리한다.
// 인자 없이 실행하면 미리보기만 하고, --apply 를 붙이면 백업한 뒤 정리한다.
import {
  existsSync, readFileSync, writeFileSync, renameSync, rmSync, mkdirSync,
  cpSync, copyFileSync, realpathSync, statSync, unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = 'non-dev-token-saver';
// 예전 install.js가 settings.json에 넣은 훅: <설정 폴더>/plugins/non-dev-token-saver/hooks/<스크립트> (matcher 없음)
const LEGACY_HOOK = /plugins\/non-dev-token-saver\/hooks\/(haiku-router|read-guard|read-cache-cleanup|token-analytics|rtk-rewrite)\.(mjs|sh)/;
// 예전 install.js 설치본인지 가리는 파일. 둘 다 없으면 우리 것이 아니라고 본다.
const LEGACY_FILES = ['hooks/haiku-router.mjs', 'hooks/read-guard.mjs'];
// 예전 훅은 설정 폴더 아래 네 곳에 이 이름의 폴더를 만들었다.
const DATA_AREAS = [
  ['state', '읽기 중복 차단 상태 기록'],
  ['analytics', '세션 분석 기록'],
  ['cache', '캐시(프롬프트 원문이 들어 있음)'],
  ['logs', '라우터 로그'],
];
const RESTART_MSG = 'Claude Code를 다시 시작하세요. 그래야 지운 훅을 더 이상 부르지 않습니다.';
const BACKUP_NOTE = '백업 폴더에는 예전 분석 기록과 캐시가 들어 있습니다. 필요 없으면 지워도 됩니다.';

const apply = process.argv.slice(2).includes('--apply');
const configDir = resolve(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'));
// 예전 훅은 CLAUDE_CONFIG_DIR을 보지 않고 홈 폴더의 .claude만 썼다. 둘이 다르면 둘 다 살핀다.
const dataRoots = [...new Set([configDir, resolve(homedir(), '.claude')])];

const readText = (file) => readFileSync(file, 'utf8').replace(/^﻿/, '');
const isLegacyHook = (h) => !!h && typeof h.command === 'string' && LEGACY_HOOK.test(h.command.replace(/\\/g, '/'));
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  // 같은 초에 다시 실행해도 이름이 겹치지 않게 밀리초까지 붙인다
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, '0')}`;
}

// settings.json에서 예전 훅만 뺀 새 객체와 뺀 개수를 돌려준다. 원본은 바꾸지 않는다.
function stripLegacyHooks(settings) {
  let removed = 0;
  const events = {};
  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) { events[event] = groups; continue; }
    const kept = [];
    let removedHere = 0;
    for (const group of groups) {
      if (!group || !Array.isArray(group.hooks)) { kept.push(group); continue; }
      const hooks = group.hooks.filter((h) => !isLegacyHook(h));
      removedHere += group.hooks.length - hooks.length;
      if (hooks.length === group.hooks.length) kept.push(group);
      else if (hooks.length > 0) kept.push({ ...group, hooks });
    }
    removed += removedHere;
    if (removedHere === 0) events[event] = groups;
    else if (kept.length > 0) events[event] = kept; // 비게 된 이벤트 키는 지운다
  }
  const next = { ...settings, hooks: events };
  if (removed > 0 && Object.keys(events).length === 0) delete next.hooks; // 우리 훅만 있었다면 hooks 키도 지운다
  return { next, removed };
}

// 지울 대상(targets)과 건드리지 않는 것(skipped)을 모은다. 이 단계는 아무것도 바꾸지 않는다.
function collect() {
  const targets = [];
  const skipped = [];

  // settings.json을 읽지 못하면 안에 남은 예전 훅이 가리키는 옛 설치 폴더도 남긴다 (훅 오류 줄 방지)
  const settingsPath = join(configDir, 'settings.json');
  let settingsTarget = null;
  let settingsBroken = false;
  if (existsSync(settingsPath)) {
    let settings;
    try {
      settings = JSON.parse(readText(settingsPath));
    } catch (err) {
      settingsBroken = true;
      skipped.push(`${settingsPath}: settings.json을 읽지 못해(JSON 오류: ${err.message}) settings.json과 옛 설치 폴더는 그대로 둡니다. settings.json을 고친 뒤 다시 실행하세요`);
    }
    if (isObject(settings) && isObject(settings.hooks)) {
      const { next, removed } = stripLegacyHooks(settings);
      if (removed > 0) {
        settingsTarget = { kind: 'settings', path: settingsPath, root: configDir, next, label: `settings.json의 예전 훅 ${removed}개` };
      }
    }
  }

  const pluginDir = join(configDir, 'plugins', NAME);
  if (existsSync(pluginDir)) {
    if (!LEGACY_FILES.some((f) => existsSync(join(pluginDir, f)))) {
      skipped.push(`${pluginDir}: 예전 설치본의 파일이 없어 건드리지 않음`);
    } else if (settingsBroken) {
      skipped.push(`${pluginDir}: settings.json을 읽지 못해 옛 설치 폴더도 그대로 둡니다`);
    } else {
      targets.push({ kind: 'path', path: pluginDir, root: configDir, label: '예전 install.js 설치 폴더' });
    }
  }

  for (const root of dataRoots) {
    for (const [area, label] of DATA_AREAS) {
      const dir = join(root, area, NAME);
      if (existsSync(dir)) targets.push({ kind: 'path', path: dir, root, label });
    }
  }
  if (settingsTarget) targets.push(settingsTarget);

  return { targets, skipped };
}

// 설정 폴더 밖(홈 폴더의 .claude)에 있던 것은 백업 폴더의 home-claude 아래에 둔다.
const backupPath = (backupDir, t) =>
  join(backupDir, t.root === configDir ? '' : 'home-claude', relative(t.root, t.path));

function backup(targets, backupDir) {
  mkdirSync(dirname(backupDir), { recursive: true });
  mkdirSync(backupDir); // 같은 이름이 이미 있으면 실패시켜 덮어쓰지 않는다
  for (const t of targets) {
    const dest = backupPath(backupDir, t);
    mkdirSync(dirname(dest), { recursive: true });
    if (t.kind === 'settings') copyFileSync(t.path, dest); // 심볼릭 링크면 실제 내용이 복사된다
    else cpSync(t.path, dest, { recursive: true, dereference: true });
  }
}

function writeSettings(t) {
  const real = realpathSync(t.path);
  const tmp = join(dirname(real), `.settings.json.${NAME}-${process.pid}.tmp`);
  try {
    writeFileSync(tmp, JSON.stringify(t.next, null, 2) + '\n', { mode: statSync(real).mode & 0o777 });
    renameSync(tmp, real);
  } catch (err) {
    try { unlinkSync(tmp); } catch { /* 임시 파일이 없으면 무시 */ }
    throw err;
  }
}

function main() {
  const { targets, skipped } = collect();
  console.log(`${NAME} 예전 설치 정리 — ${apply ? '실행' : '미리보기 (아무것도 바꾸지 않습니다)'}`);
  console.log(`설정 폴더: ${configDir}\n`);
  if (skipped.length) {
    console.log('건드리지 않는 것:');
    for (const s of skipped) console.log(`  - ${s}`);
    console.log('');
  }
  if (targets.length === 0) {
    console.log('정리할 예전 설치 흔적이 없습니다.');
    return 0;
  }
  console.log(apply ? '정리할 것:' : '--apply 로 실행하면 백업한 뒤 정리할 것:');
  for (const t of targets) console.log(`  - ${t.label}: ${t.path}`);
  console.log('');

  if (!apply) {
    console.log(`실제로 정리하려면: node "${fileURLToPath(import.meta.url)}" --apply`);
    return 0;
  }

  const backupDir = join(configDir, 'backups', `${NAME}-v1-${timestamp()}`);
  try {
    backup(targets, backupDir);
  } catch (err) {
    console.error(`백업에 실패해서 아무것도 지우지 않았습니다: ${err.message}`);
    console.error(`만들다 만 백업 폴더가 남아 있을 수 있습니다: ${backupDir} (원본은 그대로이니 필요 없으면 지워도 됩니다)`);
    return 1;
  }
  console.log(`백업 위치: ${backupDir}`);

  // settings.json을 먼저 고친다. 실패하면 훅 파일을 남겨 두어 도구를 부를 때마다 오류가 나지 않게 한다.
  const settingsTarget = targets.find((t) => t.kind === 'settings');
  if (settingsTarget) {
    try {
      writeSettings(settingsTarget);
      console.log(`  ✓ ${settingsTarget.label} 제거`);
    } catch (err) {
      console.error(`settings.json을 고치지 못해 나머지도 지우지 않았습니다: ${err.message}`);
      return 1;
    }
  }

  let failed = 0;
  for (const t of targets.filter((x) => x.kind === 'path')) {
    try {
      rmSync(t.path, { recursive: true });
      console.log(`  ✓ ${t.label} 삭제`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${t.label} 삭제 실패: ${err.message}`);
    }
  }
  console.log(`\n${BACKUP_NOTE}\n${RESTART_MSG}`);
  return failed ? 1 : 0;
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(`예상하지 못한 오류로 멈췄습니다: ${err.message}`);
  process.exitCode = 1;
}
