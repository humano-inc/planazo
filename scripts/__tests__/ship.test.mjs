// The two refusals in front of the Ship workflow, run for real under bash with fake
// `gh`, `eas` and `expo-updates` on PATH. No network and no Expo account.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REQUIRE_GREEN_CI = fileURLToPath(new URL('../ship-require-green-ci.sh', import.meta.url));
const PLATFORMS = fileURLToPath(new URL('../ship-platforms.sh', import.meta.url));
const COMMIT = 'abc123';
const RUN_URL = 'https://github.com/humano-inc/planazo/actions/runs/1';

let dir;

/** Writes an executable that records its arguments, then runs `body`. */
function fakeBin(name, body) {
  const path = join(dir, 'bin', name);
  writeFileSync(path, `#!/bin/sh\necho "$0 $*" >> "$FAKE_CALLS"\n${body}\n`);
  chmodSync(path, 0o755);
}

function run(script, ...args) {
  return spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
      FAKE_CALLS: join(dir, 'calls'),
      FAKE_DIR: dir,
    },
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ship-'));
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'calls'), '');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('ship-require-green-ci', () => {
  function fakeRuns(runs) {
    writeFileSync(join(dir, 'runs.json'), JSON.stringify(runs));
    fakeBin('gh', 'cat "$FAKE_DIR/runs.json"');
  }

  test('passes a commit whose CI run succeeded', () => {
    fakeRuns([{ status: 'completed', conclusion: 'success', url: RUN_URL }]);
    const result = run(REQUIRE_GREEN_CI, COMMIT);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /CI passed for abc123/);
  });

  test('asks only about this commit on main, from a push', () => {
    fakeRuns([{ status: 'completed', conclusion: 'success', url: RUN_URL }]);
    run(REQUIRE_GREEN_CI, COMMIT);
    const calls = spawnSync('cat', [join(dir, 'calls')], { encoding: 'utf8' }).stdout;
    assert.match(calls, /--workflow ci\.yml --branch main --event push --commit abc123/);
  });

  test('refuses a commit CI never ran on main', () => {
    fakeRuns([]);
    const result = run(REQUIRE_GREEN_CI, COMMIT);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /::error::Not shipping abc123: CI has no run for it on main/);
  });

  for (const status of ['in_progress', 'queued', 'pending']) {
    test(`refuses while the run is ${status}, whose conclusion is empty`, () => {
      fakeRuns([{ status, conclusion: '', url: RUN_URL }]);
      const result = run(REQUIRE_GREEN_CI, COMMIT);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /CI is still running/);
      assert.ok(result.stdout.includes(RUN_URL));
    });
  }

  for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out']) {
    test(`refuses a run that finished as ${conclusion}`, () => {
      fakeRuns([{ status: 'completed', conclusion, url: RUN_URL }]);
      const result = run(REQUIRE_GREEN_CI, COMMIT);
      assert.equal(result.status, 1);
      assert.match(result.stdout, new RegExp(`CI finished as '${conclusion}'`));
      assert.ok(result.stdout.includes(RUN_URL));
    });
  }

  test('refuses when gh itself fails, rather than reading no output as a pass', () => {
    fakeBin('gh', 'echo "HTTP 401" >&2; exit 4');
    const result = run(REQUIRE_GREEN_CI, COMMIT);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
  });

  test('needs a commit', () => {
    fakeRuns([]);
    assert.notEqual(run(REQUIRE_GREEN_CI).status, 0);
  });
});

describe('ship-platforms', () => {
  /** `eas build:list` answers for the platforms named here, with one build. */
  function fakeBuilds(...platforms) {
    fakeBin(
      'expo-updates',
      'for a in "$@"; do last=$p; p=$a; done; echo "{\\"runtimeVersion\\":\\"rt-$p\\",\\"workflow\\":\\"managed\\"}"',
    );
    const cases = platforms.map((p) => `*"--platform ${p} "*) echo '[{"id":"b"}]' ;;`).join('\n');
    fakeBin('eas', `case "$*" in\n${cases}\n*) echo '[]' ;;\nesac`);
  }

  test('answers all when both platforms have a build', () => {
    fakeBuilds('ios', 'android');
    const result = run(PLATFORMS, 'production');
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), 'all');
    assert.equal(result.stderr, '');
  });

  test('answers the one platform with a build, and warns about the other', () => {
    fakeBuilds('ios');
    const result = run(PLATFORMS, 'production');
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), 'ios');
    assert.match(result.stderr, /::warning::No finished production build of android has runtime rt-android/);
  });

  test('works the other way round too', () => {
    fakeBuilds('android');
    const result = run(PLATFORMS, 'production');
    assert.equal(result.stdout.trim(), 'android');
    assert.match(result.stderr, /::warning::No finished production build of ios/);
  });

  test('refuses when the update would reach nobody', () => {
    fakeBuilds();
    const result = run(PLATFORMS, 'production');
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /::error::Not shipping: no finished production build can run this code/);
  });

  test('asks about each platform on its own runtime, on the channel given', () => {
    fakeBuilds('ios', 'android');
    run(PLATFORMS, 'preview');
    const calls = spawnSync('cat', [join(dir, 'calls')], { encoding: 'utf8' }).stdout;
    assert.match(calls, /build:list --platform ios --channel preview --runtime-version rt-ios --status finished/);
    assert.match(calls, /build:list --platform android --channel preview --runtime-version rt-android --status finished/);
  });

  test('refuses when the runtime version cannot be resolved', () => {
    fakeBuilds('ios', 'android');
    fakeBin('expo-updates', 'echo "boom" >&2; exit 1');
    const result = run(PLATFORMS, 'production');
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
  });

  test('refuses when eas cannot list builds, rather than reading it as no builds', () => {
    fakeBuilds('ios', 'android');
    fakeBin('eas', 'echo "not logged in" >&2; exit 1');
    const result = run(PLATFORMS, 'production');
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
  });

  test('needs a channel', () => {
    fakeBuilds('ios');
    assert.notEqual(run(PLATFORMS).status, 0);
  });
});
