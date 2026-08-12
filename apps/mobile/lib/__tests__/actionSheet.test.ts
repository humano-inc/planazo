import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { openActionSheet, type SheetOptions, type SheetRow } from '../actionSheet';

/**
 * `lib/testing/actionSheet` reads the same spy for screen suites, but it
 * imports `act` from RNTL, and this project is the node one with no React
 * renderer. It also exposes only the labels; the indices are what is on trial
 * here.
 */
const iosSheet = () => {
  const call = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mock.calls.at(-1)!;
  return { config: call[0] as Record<string, unknown>, pick: call[1] as (i: number) => void };
};

const androidAlert = () => {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1)!;
  return {
    title: call[0] as string,
    message: call[1] as string | undefined,
    buttons: call[2] as { text: string; style?: string; onPress?: () => void }[],
  };
};

const originalOS = Platform.OS;

const takePhoto = jest.fn();
const remove = jest.fn();

const rows = (): SheetRow[] => [
  { label: 'Take a photo', run: takePhoto },
  { label: 'Use the letter instead', run: remove, destructive: true },
];

beforeEach(() => {
  jest.restoreAllMocks();
  takePhoto.mockClear();
  remove.mockClear();
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

// Platform.OS is a plain property, so each suite sets it and this puts it back.
afterEach(() => {
  Platform.OS = originalOS;
});

const open = (extra: Partial<SheetOptions> = {}) =>
  openActionSheet({ androidTitle: 'Group photo', rows: rows(), ...extra });

describe('openActionSheet on iOS', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  it('appends the cancel row and points the sheet at its index', () => {
    open();

    expect(iosSheet().config.options).toEqual([
      'Take a photo',
      'Use the letter instead',
      'Cancel',
    ]);
    expect(iosSheet().config.cancelButtonIndex).toBe(2);
  });

  /**
   * The bug the derivation removes: the profile sheet hardcoded index 3 for
   * cancel and 2 for the destructive row, so a fourth choice would have gone
   * to the wrong handler on one platform and not the other.
   */
  it('finds the destructive row wherever it sits, and omits the key when there is none', () => {
    open();
    expect(iosSheet().config.destructiveButtonIndex).toBe(1);

    open({ rows: [{ label: 'Take a photo', run: takePhoto }] });
    expect('destructiveButtonIndex' in iosSheet().config).toBe(false);
  });

  it('runs the row that was picked', () => {
    open();

    iosSheet().pick(1);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(takePhoto).not.toHaveBeenCalled();
  });

  /** Cancel indexes past the end of the rows, so it must resolve to nothing. */
  it('does nothing when the cancel row is picked', () => {
    open();

    iosSheet().pick(2);

    expect(takePhoto).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('carries the message as the sheet title, and omits it when there is none', () => {
    open({ message: 'A photo makes the group easier to spot.' });
    expect(iosSheet().config.title).toBe('A photo makes the group easier to spot.');

    open();
    expect('title' in iosSheet().config).toBe(false);
  });

  it('takes a cancel label of its own, for a sheet that already offers a way out', () => {
    open({ cancelLabel: 'Close' });

    expect((iosSheet().config.options as string[]).at(-1)).toBe('Close');
  });
});

describe('openActionSheet on Android', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });

  it('titles the dialog and puts the message under it', () => {
    open({ message: 'A photo makes the group easier to spot.' });

    expect(androidAlert().title).toBe('Group photo');
    expect(androidAlert().message).toBe('A photo makes the group easier to spot.');
  });

  // The styles reach the button objects and no further: RN's Android Alert
  // forwards only each button's text to the native dialog.
  it('turns each row into a button, marks the destructive one, and puts cancel last', () => {
    open();

    expect(androidAlert().buttons.map((b) => b.text)).toEqual([
      'Take a photo',
      'Use the letter instead',
      'Cancel',
    ]);
    expect(androidAlert().buttons.map((b) => b.style)).toEqual([
      undefined,
      'destructive',
      'cancel',
    ]);
  });

  it('runs the row that was pressed', () => {
    open();

    androidAlert().buttons[0]!.onPress!();

    expect(takePhoto).toHaveBeenCalledTimes(1);
  });
});
