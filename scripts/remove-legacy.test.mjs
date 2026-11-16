// 실행: node scripts/remove-legacy.test.mjs
// 임시 설정 폴더(CLAUDE_CONFIG_DIR)와 임시 HOME에 예전 설치 흔적을 만들고 정리 도구를 실제 프로세스로 돌려 확인한다.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync,
  readlinkSync, realpathSync, rmSync, symlinkSync, existsSync, chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'remove-legacy.mjs');
const base = realpathSync(mkdtempSync(join(tmpdir(), 'nts-remove-')));

const legacy = (script, extra = {}) => ({ type: 'command', command: `node "/Users/x/.claude/plugins/non-dev-token-saver/hooks/${script}"`, ...extra });
const HAIKU = legacy('haiku-router.mjs', { timeout: 5 });
const GUARD = legacy('read-guard.mjs', { timeout: 5 });
const RTK = { type: 'command', command: 'bash "/Users/x/.claude/plugins/non-dev-token-saver/hooks/rtk-rewrite.sh"', timeout: 5 };
const CLEANUP = legacy('read-cache-cleanup.mjs');
const ANALYTICS = legacy('token-analytics.mjs', { timeout: 10 });
const WIN = { type: 'command', command: 'node "C:\\Users\\x\\.claude\\plugins\\non-dev-token-saver\\hooks\\read-guard.mjs"' };
const OTHER = { type: 'command', command: 'node other.mjs' };
const OTHER_WIN = { type: 'command', command: 'node other-win.mjs' };
const STOP = { type: 'command', command: 'node stop.mjs' };
// 우리 것이 아닌 훅: 개발용 복제본, 마켓 설치본(plugins/cache), 사용자가 직접 둔 rtk 스크립트
const DECOY_DEV = { type: 'command', command: 'node "/Users/x/Desktop/non-dev-token-saver/hooks/read-guard.mjs"' };
const DECOY_CACHE = { type: 'command', command: 'node "/Users/x/.claude/plugins/cache/non-dev-token-saver/non-dev-token-saver/2.0.0/hooks/read-guard.mjs"' };
const DECOY_RTK = { type: 'command', command: '/Users/x/.claude/hooks/rtk-rewrite.sh' };

const SETTINGS = {
  model: 'opus',
  hooks: {
    PreToolUse: [
      { hooks: [HAIKU] },
      { hooks: [GUARD] },
      { hooks: [RTK] },
      { matcher: 'Bash', hooks: [OTHER] },
      { hooks: [DECOY_DEV, DECOY_CACHE, DECOY_RTK] },
      { matcher: 'Read', hooks: [WIN, OTHER_WIN] },
    ],
    SessionEnd: [{ hooks: [CLEANUP] }, { hooks: [ANALYTICS] }],
    Stop: [{ hooks: [STOP] }],
  },
  permissions: { deny: ['Read(.env)'] },
};
const SETTINGS_AFTER = {
  model: 'opus',
  hooks: {
    PreToolUse: [
      { matcher: 'Bash', hooks: [OTHER] },
      { hooks: [DECOY_DEV, DECOY_CACHE, DECOY_RTK] },
      { matcher: 'Read', hooks: [OTHER_WIN] },
    ],
    Stop: [{ hooks: [STOP] }],
  },
  permissions: { deny: ['Read(.env)'] },
};
const REMOVED_HOOKS = 6;

let fixtureCount = 0;
function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

// 예전 설치 흔적과 남의 파일이 섞인 설정 폴더를 만든다. 폴더마다 HOME도 따로 둔다.
// defaultDir이면 CLAUDE_CONFIG_DIR 없이 HOME/.claude를 설정 폴더로 쓴다.
function makeConfig({ settingsText = JSON.stringify(SETTINGS, null, 4), defaultDir = false, pluginFiles = true } = {}) {
  fixtureCount += 1;
  const home = join(base, `home-${fixtureCount}`);
  const dir = defaultDir ? join(home, '.claude') : join(base, `config-${fixtureCount}`);
  mkdirSync(home, { recursive: true });
  const plugin = join(dir, 'plugins', 'non-dev-token-saver');
  if (pluginFiles) {
    write(join(plugin, 'hooks', 'haiku-router.mjs'), '// v1\n');
    write(join(plugin, 'hooks', 'read-guard.mjs'), '// v1\n');
    write(join(plugin, 'install.js'), '// v1\n');
    write(join(plugin, '.claude', 'settings.json'), '{}\n');
  } else {
    write(join(plugin, 'notes.txt'), '내가 만든 폴더\n');
  }
  write(join(dir, 'plugins', 'cache', 'non-dev-token-saver', 'non-dev-token-saver', '2.0.0', 'hooks', 'hooks.json'), '{}\n');
  write(join(dir, 'plugins', 'installed_plugins.json'), '{}\n');
  write(join(dir, 'plugins', 'other-plugin', 'x.txt'), '유지\n');
  write(join(dir, 'state', 'non-dev-token-saver', 'read-cache', 's1.json'), '{}\n');
  write(join(dir, 'state', 'other-plugin', 'keep.txt'), '유지\n');
  write(join(dir, 'analytics', 'non-dev-token-saver', 'sessions.jsonl'), '{"session_id":"s1"}\n');
  write(join(dir, 'analytics', 'other', 'keep.txt'), '유지\n');
  write(join(dir, 'cache', 'non-dev-token-saver', 'hook-results.json'), '{"prompt":"원문"}\n');
  write(join(dir, 'logs', 'non-dev-token-saver', 'haiku-router.jsonl'), '{}\n');
  write(join(dir, 'hooks', 'rtk-rewrite.sh'), '#!/bin/sh\n');
  write(join(dir, '.session-stats.json'), '{}\n');
  if (settingsText !== null) write(join(dir, 'settings.json'), settingsText);
  return { dir, home, defaultDir };
}

// 폴더 전체를 { 상대경로: 내용 } 으로 찍는다. 심볼릭 링크는 링크 자체를 기록한다.
function snapshot(root) {
  const out = {};
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      const st = lstatSync(p);
      if (st.isSymbolicLink()) out[r] = `link -> ${readlinkSync(p)}`;
      else if (st.isDirectory()) { out[r] = 'dir'; walk(p, r); }
      else out[r] = readFileSync(p, 'utf8');
    }
  };
  walk(root, '');
  return out;
}

function run(fx, args = []) {
  assert.ok(fx.home.startsWith(base + sep), '임시 폴더 밖의 HOME으로는 실행하지 않는다');
  const env = { ...process.env, HOME: fx.home, USERPROFILE: fx.home };
  if (fx.defaultDir) delete env.CLAUDE_CONFIG_DIR;
  else {
    assert.ok(fx.dir.startsWith(base + sep), '임시 폴더 밖의 설정 폴더로는 실행하지 않는다');
    env.CLAUDE_CONFIG_DIR = fx.dir;
  }
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { env, encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
}

const backupsOf = (dir) => (existsSync(join(dir, 'backups')) ? readdirSync(join(dir, 'backups')) : []);
const ours = (dir) => [
  join(dir, 'plugins', 'non-dev-token-saver'),
  join(dir, 'state', 'non-dev-token-saver'),
  join(dir, 'analytics', 'non-dev-token-saver'),
  join(dir, 'cache', 'non-dev-token-saver'),
  join(dir, 'logs', 'non-dev-token-saver'),
];

// 남의 것, 마켓 설치본, 다른 도구의 상태 파일은 그대로 있어야 한다.
function assertOthersKept(dir) {
  for (const rel of [
    ['plugins', 'cache', 'non-dev-token-saver', 'non-dev-token-saver', '2.0.0', 'hooks', 'hooks.json'],
    ['plugins', 'installed_plugins.json'],
    ['plugins', 'other-plugin', 'x.txt'],
    ['state', 'other-plugin', 'keep.txt'],
    ['analytics', 'other', 'keep.txt'],
    ['hooks', 'rtk-rewrite.sh'],
    ['.session-stats.json'],
  ]) assert.ok(existsSync(join(dir, ...rel)), `${rel.join('/')}가 지워짐`);
}

function assertCleaned(dir) {
  for (const p of ours(dir)) assert.equal(existsSync(p), false, `${p}가 남음`);
  assertOthersKept(dir);
}

const tests = [
  ['미리보기는 아무것도 바꾸지 않음 (backups 폴더도 만들지 않음)', () => {
    const fx = makeConfig();
    const before = snapshot(fx.dir);
    const r = run(fx);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /미리보기/);
    for (const p of ours(fx.dir)) assert.ok(r.out.includes(p), `${p}가 목록에 없음`);
    assert.ok(r.out.includes(`settings.json의 예전 훅 ${REMOVED_HOOKS}개`), r.out);
    assert.deepEqual(snapshot(fx.dir), before);
  }],
  ['--apply는 백업을 만들고 우리 것만 지움, settings.json은 예전 훅만 뺌', () => {
    const settingsText = JSON.stringify(SETTINGS, null, 4);
    const fx = makeConfig({ settingsText });
    const r = run(fx, ['--apply']);
    assert.equal(r.status, 0, r.out);
    assertCleaned(fx.dir);
    assert.equal(readFileSync(join(fx.dir, 'settings.json'), 'utf8'), JSON.stringify(SETTINGS_AFTER, null, 2) + '\n');
    assert.ok(r.out.includes('Claude Code를 다시 시작하세요.'));

    const backups = backupsOf(fx.dir);
    assert.equal(backups.length, 1);
    assert.match(backups[0], /^non-dev-token-saver-v1-\d{8}-\d{6}-\d{3}$/);
    const b = join(fx.dir, 'backups', backups[0]);
    assert.equal(readFileSync(join(b, 'settings.json'), 'utf8'), settingsText);
    assert.ok(existsSync(join(b, 'plugins', 'non-dev-token-saver', 'install.js')));
    assert.ok(existsSync(join(b, 'plugins', 'non-dev-token-saver', '.claude', 'settings.json')));
    assert.ok(existsSync(join(b, 'state', 'non-dev-token-saver', 'read-cache', 's1.json')));
    assert.ok(existsSync(join(b, 'analytics', 'non-dev-token-saver', 'sessions.jsonl')));
    assert.ok(existsSync(join(b, 'cache', 'non-dev-token-saver', 'hook-results.json')));
    assert.ok(existsSync(join(b, 'logs', 'non-dev-token-saver', 'haiku-router.jsonl')));
    assert.equal(existsSync(join(b, 'plugins', 'other-plugin')), false, '대상이 아닌 것까지 백업함');
    assert.equal(existsSync(join(b, 'state', 'other-plugin')), false, '대상이 아닌 것까지 백업함');
  }],
  ['두 번째 실행은 정리할 것이 없고 새 백업도 만들지 않음', () => {
    const fx = makeConfig();
    assert.equal(run(fx, ['--apply']).status, 0);
    const r = run(fx, ['--apply']);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /정리할 예전 설치 흔적이 없습니다/);
    assert.equal(backupsOf(fx.dir).length, 1);
  }],
  ['CLAUDE_CONFIG_DIR이 달라도 홈 폴더의 .claude에 남은 상태·분석·캐시·로그를 찾아 백업하고 지움', () => {
    const fx = makeConfig();
    const homeClaude = join(fx.home, '.claude');
    write(join(homeClaude, 'state', 'non-dev-token-saver', 'read-cache', 'h1.json'), '{}\n');
    write(join(homeClaude, 'analytics', 'non-dev-token-saver', 'sessions.jsonl'), '{}\n');
    write(join(homeClaude, 'cache', 'non-dev-token-saver', 'hook-results.json'), '{}\n');
    write(join(homeClaude, 'logs', 'non-dev-token-saver', 'haiku-router.jsonl'), '{}\n');
    write(join(homeClaude, 'state', 'other-plugin', 'keep.txt'), '유지\n');
    assert.ok(run(fx).out.includes(join(homeClaude, 'logs', 'non-dev-token-saver')));
    const r = run(fx, ['--apply']);
    assert.equal(r.status, 0, r.out);
    assertCleaned(fx.dir);
    for (const area of ['state', 'analytics', 'cache', 'logs']) {
      assert.equal(existsSync(join(homeClaude, area, 'non-dev-token-saver')), false, `홈 폴더의 ${area}가 남음`);
    }
    assert.ok(existsSync(join(homeClaude, 'state', 'other-plugin', 'keep.txt')), '홈 폴더의 남의 파일이 지워짐');
    const b = join(fx.dir, 'backups', backupsOf(fx.dir)[0], 'home-claude');
    assert.ok(existsSync(join(b, 'state', 'non-dev-token-saver', 'read-cache', 'h1.json')));
    assert.ok(existsSync(join(b, 'logs', 'non-dev-token-saver', 'haiku-router.jsonl')));
  }],
  ['CLAUDE_CONFIG_DIR이 없으면 HOME/.claude를 설정 폴더로 쓰고 같은 폴더를 두 번 세지 않음', () => {
    const fx = makeConfig({ defaultDir: true });
    const r = run(fx);
    assert.equal(r.status, 0, r.out);
    const logs = join(fx.dir, 'logs', 'non-dev-token-saver');
    assert.equal(r.out.split(logs).length - 1, 1, `${logs}가 한 번만 나와야 함\n${r.out}`);
    assert.equal(run(fx, ['--apply']).status, 0);
    assertCleaned(fx.dir);
    assert.equal(backupsOf(fx.dir).length, 1);
    assert.equal(existsSync(join(fx.dir, 'backups', backupsOf(fx.dir)[0], 'home-claude')), false);
  }],
  ['우리 훅만 있던 settings.json은 이벤트 키와 hooks 키까지 지움', () => {
    const only = { model: 'opus', hooks: { PreToolUse: [{ hooks: [HAIKU, GUARD, RTK] }], SessionEnd: [{ hooks: [CLEANUP, ANALYTICS] }] } };
    const fx = makeConfig({ settingsText: JSON.stringify(only) });
    assert.equal(run(fx, ['--apply']).status, 0);
    assert.equal(readFileSync(join(fx.dir, 'settings.json'), 'utf8'), JSON.stringify({ model: 'opus' }, null, 2) + '\n');
  }],
  ['예전 훅이 없는 settings.json은 고치지 않고 다른 흔적만 정리', () => {
    const text = JSON.stringify({ model: 'opus', hooks: { Stop: [{ hooks: [STOP] }] } });
    const fx = makeConfig({ settingsText: text });
    const r = run(fx, ['--apply']);
    assert.equal(r.status, 0, r.out);
    assert.equal(readFileSync(join(fx.dir, 'settings.json'), 'utf8'), text);
    assert.equal(r.out.includes('settings.json의 예전 훅'), false, r.out);
    assertCleaned(fx.dir);
  }],
  ['hooks가 객체가 아니거나 settings.json이 배열이어도 멈추지 않음', () => {
    for (const text of ['[]', 'null', '{"hooks":[1]}', '{"hooks":{"Stop":"x","PreToolUse":[null,{"hooks":"y"}]}}']) {
      const fx = makeConfig({ settingsText: text });
      const r = run(fx, ['--apply']);
      assert.equal(r.status, 0, `${text}\n${r.out}`);
      assert.equal(readFileSync(join(fx.dir, 'settings.json'), 'utf8'), text);
      assertCleaned(fx.dir);
    }
  }],
  ['예전 설치 파일이 없는 plugins/non-dev-token-saver 폴더는 남김', () => {
    const fx = makeConfig({ pluginFiles: false });
    const r = run(fx, ['--apply']);
    assert.equal(r.status, 0, r.out);
    assert.ok(existsSync(join(fx.dir, 'plugins', 'non-dev-token-saver', 'notes.txt')), '남의 폴더가 지워짐');
    assert.match(r.out, /예전 설치본의 파일이 없어 건드리지 않음/);
    for (const p of ours(fx.dir).slice(1)) assert.equal(existsSync(p), false, `${p}가 남음`);
  }],
  ['깨진 settings.json이면 settings.json과 옛 설치 폴더는 남기고 상태·분석·캐시·로그만 정리', () => {
    const broken = '{ "hooks": { "PreToolUse": [ broken';
    const fx = makeConfig({ settingsText: broken });
    const pluginBefore = snapshot(join(fx.dir, 'plugins', 'non-dev-token-saver'));
    const r = run(fx, ['--apply']);
    assert.equal(r.status, 0, r.out);
    assert.equal(readFileSync(join(fx.dir, 'settings.json'), 'utf8'), broken);
    assert.deepEqual(snapshot(join(fx.dir, 'plugins', 'non-dev-token-saver')), pluginBefore, '옛 설치 폴더가 바뀜');
    for (const p of ours(fx.dir).slice(1)) assert.equal(existsSync(p), false, `${p}가 남음`);
    assert.match(r.out, /settings\.json을 읽지 못해\(JSON 오류: .*\) settings\.json과 옛 설치 폴더는 그대로 둡니다\. settings\.json을 고친 뒤 다시 실행하세요/);
  }],
  ['깨진 settings.json을 고친 뒤 다시 실행하면 남은 것을 정리', () => {
    const fx = makeConfig({ settingsText: '{ broken' });
    assert.equal(run(fx, ['--apply']).status, 0);
    writeFileSync(join(fx.dir, 'settings.json'), JSON.stringify(SETTINGS));
    const r = run(fx, ['--apply']);
    assert.equal(r.status, 0, r.out);
    assertCleaned(fx.dir);
    assert.deepEqual(JSON.parse(readFileSync(join(fx.dir, 'settings.json'), 'utf8')), SETTINGS_AFTER);
  }],
  ['BOM이 붙은 settings.json도 읽어서 처리', () => {
    const fx = makeConfig({ settingsText: '\uFEFF' + JSON.stringify(SETTINGS) });
    assert.equal(run(fx, ['--apply']).status, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(fx.dir, 'settings.json'), 'utf8')), SETTINGS_AFTER);
  }],
  ['settings.json이 없어도 나머지는 정리', () => {
    const fx = makeConfig({ settingsText: null });
    const r = run(fx, ['--apply']);
    assert.equal(r.status, 0, r.out);
    assertCleaned(fx.dir);
    assert.equal(existsSync(join(fx.dir, 'settings.json')), false);
  }],
  ['심볼릭 링크 settings.json은 링크를 유지하고 실제 파일에 씀', () => {
    if (process.platform === 'win32') return 'skip'; // Windows는 링크 생성에 관리자 권한이 필요할 수 있음
    const fx = makeConfig({ settingsText: null });
    const realFile = join(base, `real-settings-${fixtureCount}.json`);
    const original = JSON.stringify(SETTINGS, null, 2);
    writeFileSync(realFile, original);
    symlinkSync(realFile, join(fx.dir, 'settings.json'));
    const r = run(fx, ['--apply']);
    assert.equal(r.status, 0, r.out);
    assert.ok(lstatSync(join(fx.dir, 'settings.json')).isSymbolicLink(), '링크가 일반 파일로 바뀜');
    assert.equal(readFileSync(realFile, 'utf8'), JSON.stringify(SETTINGS_AFTER, null, 2) + '\n');
    const b = join(fx.dir, 'backups', backupsOf(fx.dir)[0], 'settings.json');
    assert.ok(!lstatSync(b).isSymbolicLink(), '백업이 링크로 남음');
    assert.equal(readFileSync(b, 'utf8'), original);
  }],
  ['백업에 실패하면 아무것도 지우지 않고 종료 코드 1', () => {
    const fx = makeConfig();
    write(join(fx.dir, 'backups'), '폴더 자리에 놓인 파일\n');
    const before = snapshot(fx.dir);
    const r = run(fx, ['--apply']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /백업에 실패해서 아무것도 지우지 않았습니다/);
    assert.match(r.out, /만들다 만 백업 폴더가 남아 있을 수 있습니다/);
    assert.deepEqual(snapshot(fx.dir), before);
  }],
  ['백업 도중 실패하면 반쯤 만든 백업 폴더를 알리고 아무것도 지우지 않음', () => {
    if (process.platform === 'win32' || process.getuid() === 0) return 'skip'; // 읽기 금지(chmod 000) 흉내가 POSIX 일반 사용자 전용
    const fx = makeConfig();
    const settingsBefore = readFileSync(join(fx.dir, 'settings.json'), 'utf8');
    const locked = join(fx.dir, 'plugins', 'non-dev-token-saver', 'locked.txt');
    write(locked, '읽을 수 없는 파일\n');
    chmodSync(locked, 0o000);
    try {
      const r = run(fx, ['--apply']);
      assert.equal(r.status, 1, r.out);
      const backups = backupsOf(fx.dir);
      assert.equal(backups.length, 1, '반쯤 만든 백업 폴더가 없음');
      assert.ok(r.out.includes(`만들다 만 백업 폴더가 남아 있을 수 있습니다: ${join(fx.dir, 'backups', backups[0])}`), r.out);
      for (const p of ours(fx.dir)) assert.ok(existsSync(p), `${p}가 지워짐`);
      assert.equal(readFileSync(join(fx.dir, 'settings.json'), 'utf8'), settingsBefore);
    } finally {
      chmodSync(locked, 0o644);
    }
  }],
  ['settings.json을 고치지 못하면 나머지를 지우지 않고 종료 코드 1', () => {
    if (process.platform === 'win32') return 'skip'; // 폴더 쓰기 금지(chmod) 흉내가 POSIX 전용
    const fx = makeConfig({ settingsText: null });
    const roDir = join(base, `read-only-${fixtureCount}`);
    write(join(roDir, 'settings.json'), JSON.stringify(SETTINGS, null, 2));
    symlinkSync(join(roDir, 'settings.json'), join(fx.dir, 'settings.json'));
    chmodSync(roDir, 0o555);
    try {
      const r = run(fx, ['--apply']);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /settings.json을 고치지 못해 나머지도 지우지 않았습니다/);
      for (const p of ours(fx.dir)) assert.ok(existsSync(p), `${p}가 지워짐`);
      assert.deepEqual(readdirSync(roDir), ['settings.json'], '임시 파일이 남음');
    } finally {
      chmodSync(roDir, 0o755);
    }
  }],
  ['예전 흔적이 없는 설정 폴더', () => {
    const fx = makeConfig({ settingsText: null });
    const dir = join(base, 'config-empty');
    mkdirSync(dir);
    const r = run({ dir, home: fx.home, defaultDir: false }, ['--apply']);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /정리할 예전 설치 흔적이 없습니다/);
    assert.deepEqual(readdirSync(dir), []);
  }],
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    console.log(`${fn() === 'skip' ? 'skip' : 'ok  '} ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL ${name}\n${err.message}`);
  }
}
rmSync(base, { recursive: true, force: true });
console.log(`\n${tests.length - failed}/${tests.length} 통과`);
process.exitCode = failed ? 1 : 0;
