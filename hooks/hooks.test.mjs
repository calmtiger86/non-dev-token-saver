// 실행: node hooks/hooks.test.mjs
// hooks.json의 훅 명령을 sh -c 로 직접 돌려, rtk가 없거나 비정상 종료해도 도구 호출을 막지 않는지 확인한다.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform === 'win32') {
  console.log('skip Windows에서는 sh가 없어 건너뜁니다');
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, 'hooks.json'), 'utf8'));
const base = realpathSync(mkdtempSync(join(tmpdir(), 'nts-hook-')));
const INPUT = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' } });

function stubBin(name, script) {
  const dir = join(base, name);
  mkdirSync(dir);
  if (script !== null) {
    writeFileSync(join(dir, 'rtk'), `#!/bin/sh\n${script}\n`);
    chmodSync(join(dir, 'rtk'), 0o755);
  }
  return dir;
}

// 훅 명령은 sh 전용 문법을 쓰지 않아야 PowerShell 5.1에서도 문법 오류가 나지 않는다.
function runHook(command, binDir) {
  const r = spawnSync('/bin/sh', ['-c', command], { input: INPUT, encoding: 'utf8', env: { PATH: binDir } });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const group = config.hooks.PreToolUse[0];
const command = group.hooks[0].command;

const tests = [
  ['등록은 Bash 도구 하나뿐이고 훅 이벤트도 PreToolUse 하나뿐', () => {
    assert.deepEqual(Object.keys(config.hooks), ['PreToolUse']);
    assert.equal(config.hooks.PreToolUse.length, 1);
    assert.equal(group.matcher, 'Bash');
    assert.equal(group.hooks.length, 1);
  }],
  ['명령 줄에 sh 전용 문법이 없음', () => {
    for (const bad of ['&&', '||', 'command -v', '/dev/null', '[ ', '$(', '`']) {
      assert.ok(!command.includes(bad), `sh 전용 문법 "${bad}"가 있음: ${command}`);
    }
  }],
  ['rtk가 PATH에 없으면 종료 코드 0, 표준 출력 없음', () => {
    const r = runHook(command, stubBin('empty', null));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '');
  }],
  ['rtk가 종료 코드 2로 끝나도(옛 rtk의 알 수 없는 하위 명령 등) 0으로 끝남', () => {
    const r = runHook(command, stubBin('exit2', 'echo "error: unrecognized subcommand" >&2; exit 2'));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '');
  }],
  ['rtk 출력은 그대로 전달되고 입력 JSON이 표준 입력으로 들어감', () => {
    const r = runHook(command, stubBin('echo', '/bin/cat'));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, INPUT);
  }],
  ['실제 rtk가 있으면 종료 코드 0이고, 출력이 있다면 PreToolUse 형식', () => {
    const which = spawnSync('/bin/sh', ['-c', 'command -v rtk'], { encoding: 'utf8' });
    if (which.status !== 0) return 'skip';
    const r = runHook(command, `${dirname(which.stdout.trim())}:/usr/bin:/bin`);
    assert.equal(r.status, 0, r.stderr);
    if (r.stdout.trim()) assert.equal(JSON.parse(r.stdout).hookSpecificOutput.hookEventName, 'PreToolUse');
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
