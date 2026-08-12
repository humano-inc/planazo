import { ActionSheetIOS, Alert, Platform } from 'react-native';

export interface SheetRow {
  label: string;
  run: () => void | Promise<void>;
  /** The one that takes something away. Red on both platforms. */
  destructive?: boolean;
}

export interface SheetOptions {
  /**
   * The sentence above the choices. iOS shows it as the sheet's title, Android
   * as the dialog's message under `androidTitle`. Omit for a bare menu.
   */
  message?: string;
  /**
   * The short line Android's dialog wants above the message. iOS gets no
   * equivalent: a sheet here carries one line of context, and on iOS that line
   * is `message`.
   */
  androidTitle: string;
  /** "Cancel" unless the sheet already contains something a user could read as cancelling. */
  cancelLabel?: string;
  rows: SheetRow[];
}

/**
 * The platform's own menu of choices, from one list (PLA-117).
 *
 * Three screens each wrote this out, and the interesting part is what the
 * copies disagreed about: the profile photo sheet hardcoded `cancelButtonIndex:
 * 3` and dispatched on `index === 2`, so adding a choice meant editing four
 * numbers in two branches and the Android branch could silently keep the old
 * order. Deriving every index from the list is what makes a choice you add
 * later reach the handler it was written for.
 *
 * Rows are built by the caller, so a choice that only exists sometimes (a
 * "remove" with nothing to remove) is a filtered array rather than a position
 * anybody has to remember.
 *
 * The platforms are not equivalent past that, and this does not pretend they
 * are. RN's Android `Alert` keeps `buttons.slice(0, 3)` and forwards only
 * their text to the native dialog, so a fourth row takes the cancel behind it
 * off the screen, and `style` reaches nothing. Both were already true of the
 * three sheets this replaced, and the plan menu is the one that can build
 * five.
 */
export function openActionSheet({
  message,
  androidTitle,
  cancelLabel = 'Cancel',
  rows,
}: SheetOptions): void {
  if (Platform.OS === 'ios') {
    // iOS reddens one row, Android every row that asks. No sheet has two, so
    // the platforms agree; a second destructive row is what would part them.
    const destructive = rows.findIndex((r) => r.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        ...(message ? { title: message } : {}),
        options: [...rows.map((r) => r.label), cancelLabel],
        cancelButtonIndex: rows.length,
        ...(destructive >= 0 ? { destructiveButtonIndex: destructive } : {}),
      },
      // Cancel indexes past the end, so it resolves to undefined and no-ops.
      (index) => void rows[index]?.run()
    );
    return;
  }

  Alert.alert(androidTitle, message, [
    ...rows.map((r) => ({
      text: r.label,
      style: r.destructive ? ('destructive' as const) : undefined,
      onPress: () => void r.run(),
    })),
    { text: cancelLabel, style: 'cancel' as const },
  ]);
}
