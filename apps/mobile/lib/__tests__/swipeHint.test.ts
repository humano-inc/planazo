import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const getItem = SecureStore.getItemAsync as jest.Mock;
const setItem = SecureStore.setItemAsync as jest.Mock;

/**
 * The module latches for the life of the process, which is the point of it, so
 * every test needs a fresh copy rather than a shared one carrying the last
 * test's answer.
 */
function load() {
  let mod: typeof import('../swipeHint');
  jest.isolateModules(() => {
    mod = require('../swipeHint');
  });
  return mod!;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('shouldPeekSwipeHint', () => {
  it('says yes to somebody who has never seen it', async () => {
    await expect(load().shouldPeekSwipeHint()).resolves.toBe(true);
  });

  it('says no once the flag is on disk', async () => {
    getItem.mockResolvedValue('1');
    await expect(load().shouldPeekSwipeHint()).resolves.toBe(false);
  });

  it('stops reading the keychain once it knows the answer is no', async () => {
    getItem.mockResolvedValue('1');
    const { shouldPeekSwipeHint } = load();

    await shouldPeekSwipeHint();
    await shouldPeekSwipeHint();

    expect(getItem).toHaveBeenCalledTimes(1);
  });

  // Being unable to tell is not a reason to show somebody a demo they may have
  // watched a hundred times. The caption under the list still explains it.
  it('says no rather than guess when the keychain cannot be read', async () => {
    getItem.mockRejectedValue(new Error('keychain unavailable'));
    const { shouldPeekSwipeHint } = load();

    await expect(shouldPeekSwipeHint()).resolves.toBe(false);
    // And it does not go back for a second opinion.
    await expect(shouldPeekSwipeHint()).resolves.toBe(false);
    expect(getItem).toHaveBeenCalledTimes(1);
  });
});

describe('markSwipeHintSeen', () => {
  it('writes the flag, and the next ask answers no without reading', async () => {
    const { shouldPeekSwipeHint, markSwipeHintSeen } = load();

    expect(await shouldPeekSwipeHint()).toBe(true);
    await markSwipeHintSeen();

    expect(setItem).toHaveBeenCalledWith(expect.stringContaining('member-swipe'), '1');
    expect(await shouldPeekSwipeHint()).toBe(false);
  });

  // The failure that matters: a write that never lands must not put the row
  // back to twitching on every mount for the rest of the session.
  it('holds for the session even when the write fails', async () => {
    setItem.mockRejectedValue(new Error('keychain full'));
    const { shouldPeekSwipeHint, markSwipeHintSeen } = load();

    await expect(markSwipeHintSeen()).resolves.toBeUndefined();
    await expect(shouldPeekSwipeHint()).resolves.toBe(false);
  });

  it('a fresh launch after a failed write offers the hint again', async () => {
    setItem.mockRejectedValue(new Error('keychain full'));
    await load().markSwipeHintSeen();

    // Nothing was persisted, so the next process has no flag to find.
    await expect(load().shouldPeekSwipeHint()).resolves.toBe(true);
  });
});
