// The simulator helpers in worktree-common.sh, run for real under bash with a fake
// `xcrun` on PATH. Runs on any OS: nothing here needs Xcode.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const COMMON = fileURLToPath(new URL('../worktree-common.sh', import.meta.url));
const SIM_RUNTIME = 'com.apple.CoreSimulator.SimRuntime';
const IPHONE_16_PRO = 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro';
const IPHONE_DUO = 'com.apple.CoreSimulator.SimDeviceType.iPhone-Duo';

// Listed first, as simctl lists it on an Xcode 27 machine: the trap for any
// fallback that only looks at the version.
const DEVICE_SPECIFIC_27_2 = {
  identifier: `${SIM_RUNTIME}.iOS-27-2-iPhone19-4`,
  version: '27.2',
  isAvailable: true,
  supportedDeviceTypes: [{ identifier: IPHONE_DUO }],
};
const GENERAL_27_2 = {
  identifier: `${SIM_RUNTIME}.iOS-27-2`,
  version: '27.2',
  isAvailable: true,
  supportedDeviceTypes: [{ identifier: IPHONE_16_PRO }],
};
const GENERAL_18_5 = {
  identifier: `${SIM_RUNTIME}.iOS-18-5`,
  version: '18.5',
  isAvailable: true,
  supportedDeviceTypes: [{ identifier: IPHONE_16_PRO }],
};

function device(name, udid, isAvailable = true) {
  return { name, udid, isAvailable };
}

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'wt-sim-'));
  mkdirSync(join(dir, 'bin'));
  // Two JSON files stand in for the two listings. A missing file makes `cat` exit
  // non-zero with no output, which is what xcrun does on a machine without Xcode.
  writeFileSync(join(dir, 'bin/xcrun'), '#!/bin/sh\ncat "$FAKE_SIMCTL_DIR/$3.json"\n');
  chmodSync(join(dir, 'bin/xcrun'), 0o755);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function fakeDevices(devices) {
  writeFileSync(join(dir, 'devices.json'), JSON.stringify({ devices }));
}

function fakeRuntimes(runtimes) {
  writeFileSync(join(dir, 'runtimes.json'), JSON.stringify({ runtimes }));
}

function envFile(contents) {
  const path = join(dir, 'mobile.env');
  writeFileSync(path, contents);
  return path;
}

function run(script, ...args) {
  return spawnSync('bash', ['-c', `source "$WT_COMMON"\n${script}`, 'bash', ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
      HOME: dir,
      FAKE_SIMCTL_DIR: dir,
      WT_COMMON: COMMON,
    },
  });
}

describe('wt_sim_runtime_of', () => {
  const runtimeOf = (udid, name) => run('wt_sim_runtime_of "$1" "$2"', udid, name).stdout.trim();

  test('finds the runtime by UDID', () => {
    fakeDevices({ [GENERAL_27_2.identifier]: [device('iPhone 16 Pro', 'U1')] });
    assert.equal(runtimeOf('U1', ''), GENERAL_27_2.identifier);
  });

  test('prefers the UDID when the name points somewhere else', () => {
    fakeDevices({
      [GENERAL_18_5.identifier]: [device('iPhone 16 Pro', 'OTHER')],
      [GENERAL_27_2.identifier]: [device('Renamed', 'U1')],
    });
    assert.equal(runtimeOf('U1', 'iPhone 16 Pro'), GENERAL_27_2.identifier);
  });

  test('falls back to the name when the UDID is stale', () => {
    fakeDevices({ [GENERAL_27_2.identifier]: [device('iPhone 16 Pro', 'U1')] });
    assert.equal(runtimeOf('GONE', 'iPhone 16 Pro'), GENERAL_27_2.identifier);
  });

  test('finds the runtime by name when there is no UDID', () => {
    fakeDevices({ [GENERAL_27_2.identifier]: [device('iPhone 16 Pro', 'U1')] });
    assert.equal(runtimeOf('', 'iPhone 16 Pro'), GENERAL_27_2.identifier);
  });

  test('ignores a simulator whose runtime is no longer installed', () => {
    fakeDevices({
      [GENERAL_18_5.identifier]: [device('iPhone 16 Pro', 'U1', false)],
      [GENERAL_27_2.identifier]: [device('iPhone 16 Pro', 'U2')],
    });
    assert.equal(runtimeOf('U1', 'iPhone 16 Pro'), GENERAL_27_2.identifier);
  });

  test('is empty when nothing matches', () => {
    fakeDevices({ [GENERAL_27_2.identifier]: [device('iPhone 16 Pro', 'U1')] });
    const result = run('wt_sim_runtime_of "$1" "$2"', 'GONE', 'iPhone 99');
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  });

  test('does not match a device with no name when given no name', () => {
    fakeDevices({ [GENERAL_27_2.identifier]: [{ name: '', udid: '', isAvailable: true }] });
    assert.equal(runtimeOf('', ''), '');
  });

  test('is empty, not fatal, when simctl fails', () => {
    const result = run('wt_sim_runtime_of "$1" "$2"', 'U1', 'iPhone 16 Pro');
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  });
});

describe('wt_sim_runtimes_hosting', () => {
  const hosting = (type) =>
    run('wt_sim_runtimes_hosting "$1"', type).stdout.split('\n').filter(Boolean);

  test('leaves out a device-specific runtime of the same version', () => {
    fakeRuntimes([DEVICE_SPECIFIC_27_2, GENERAL_27_2]);
    assert.deepEqual(hosting(IPHONE_16_PRO), [GENERAL_27_2.identifier]);
  });

  test('lists a device-specific runtime for its own device', () => {
    fakeRuntimes([DEVICE_SPECIFIC_27_2, GENERAL_27_2]);
    assert.deepEqual(hosting(IPHONE_DUO), [DEVICE_SPECIFIC_27_2.identifier]);
  });

  test('sorts newest first, comparing versions as numbers', () => {
    const runtime = (version) => ({ ...GENERAL_27_2, identifier: `iOS-${version}`, version });
    fakeRuntimes([runtime('18.5'), runtime('27.2'), runtime('18.10'), runtime('9.3')]);
    assert.deepEqual(hosting(IPHONE_16_PRO), ['iOS-27.2', 'iOS-18.10', 'iOS-18.5', 'iOS-9.3']);
  });

  test('leaves out an unavailable runtime', () => {
    fakeRuntimes([{ ...GENERAL_27_2, isAvailable: false }, GENERAL_18_5]);
    assert.deepEqual(hosting(IPHONE_16_PRO), [GENERAL_18_5.identifier]);
  });

  test('is empty, not fatal, when simctl fails', () => {
    const result = run('wt_sim_runtimes_hosting "$1"', IPHONE_16_PRO);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  });
});

describe('wt_sim_runtime', () => {
  const MAIN_ENV = 'IOS_SIMULATOR=iPhone 16 Pro\nIOS_SIMULATOR_UDID=U1\n';
  const resolve = (env) => run('wt_sim_runtime "$1"', env);

  test("uses main's runtime, even when a newer one is installed", () => {
    fakeDevices({ [GENERAL_18_5.identifier]: [device('iPhone 16 Pro', 'U1')] });
    fakeRuntimes([GENERAL_27_2, GENERAL_18_5]);
    const result = resolve(envFile(MAIN_ENV));
    assert.equal(result.stdout, `${GENERAL_18_5.identifier}\n`);
    assert.equal(result.stderr, '');
  });

  test("finds main's simulator by name when the env has no UDID", () => {
    fakeDevices({ [GENERAL_18_5.identifier]: [device('iPhone 16 Pro', 'U1')] });
    fakeRuntimes([GENERAL_27_2, GENERAL_18_5]);
    const result = resolve(envFile('IOS_SIMULATOR=iPhone 16 Pro\n'));
    assert.equal(result.stdout, `${GENERAL_18_5.identifier}\n`);
  });

  test("falls back to the newest that can run the device when main's is not found", () => {
    fakeDevices({ [GENERAL_18_5.identifier]: [device('Someone else', 'U9')] });
    fakeRuntimes([DEVICE_SPECIFIC_27_2, GENERAL_18_5, GENERAL_27_2]);
    const result = resolve(envFile(MAIN_ENV));
    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${GENERAL_27_2.identifier}\n`);
    assert.match(result.stderr, /no usable runtime.*iOS-27-2/);
  });

  test('falls back when the env file does not exist', () => {
    fakeDevices({});
    fakeRuntimes([GENERAL_27_2]);
    const result = resolve(join(dir, 'missing.env'));
    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${GENERAL_27_2.identifier}\n`);
  });

  test("falls back when main's runtime cannot run the device", () => {
    fakeDevices({ [DEVICE_SPECIFIC_27_2.identifier]: [device('iPhone 16 Pro', 'U1')] });
    fakeRuntimes([DEVICE_SPECIFIC_27_2, GENERAL_27_2]);
    const result = resolve(envFile(MAIN_ENV));
    assert.equal(result.stdout, `${GENERAL_27_2.identifier}\n`);
  });

  test('dies with a message that says so when no runtime can run the device', () => {
    fakeDevices({});
    fakeRuntimes([DEVICE_SPECIFIC_27_2]);
    const result = resolve(envFile(MAIN_ENV));
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /No available iOS simulator runtime can run iPhone-16-Pro/);
  });

  test('dies the same way when simctl itself fails', () => {
    const result = resolve(envFile(MAIN_ENV));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No available iOS simulator runtime/);
  });

  test('ends a calling script that captures it', () => {
    fakeDevices({});
    fakeRuntimes([]);
    const result = run(
      'runtime=$(wt_sim_runtime "$1")\necho "carried on with [$runtime]"',
      envFile(MAIN_ENV),
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
  });
});

describe('wt_devclient_app', () => {
  const PRODUCTS = 'Build/Products/Debug-iphonesimulator/Planazo.app';

  function buildApp(hash, modifiedAt) {
    const path = join(dir, 'Library/Developer/Xcode/DerivedData', `Planazo-${hash}`, PRODUCTS);
    mkdirSync(path, { recursive: true });
    utimesSync(path, modifiedAt, modifiedAt);
    return path;
  }

  test('lets a calling script carry on with empty output when nothing is built', () => {
    const result = run('app=$(wt_devclient_app)\necho "carried on with [$app]"');
    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'carried on with []\n');
  });

  test('returns the only build', () => {
    const app = buildApp('a', new Date('2026-01-01'));
    assert.equal(run('wt_devclient_app').stdout, `${app}\n`);
  });

  test('returns the most recent of several builds', () => {
    buildApp('old', new Date('2026-01-01'));
    const newest = buildApp('new', new Date('2026-06-01'));
    assert.equal(run('wt_devclient_app').stdout, `${newest}\n`);
  });
});
