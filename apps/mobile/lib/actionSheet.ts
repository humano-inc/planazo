import { ActionSheetIOS, Platform } from 'react-native';

type SheetPresenter = (sheet: SheetOptions) => void;

let presentOnAndroid: SheetPresenter | null = null;

/** Register what draws the Android sheet. Returns the call that unregisters it. */
export function setActionSheetPresenter(presenter: SheetPresenter): () => void {
  presentOnAndroid = presenter;
  return () => {
    if (presentOnAndroid === presenter) presentOnAndroid = null;
  };
}

export interface SheetRow {
  label: string;
  run: () => void | Promise<void>;
  /** The one that takes something away. Red on both platforms. */
  destructive?: boolean;
}

export interface SheetOptions {
  /**
   * The sentence above the choices. iOS shows it as the sheet's title, Android
   * under `androidTitle`. Omit for a bare menu.
   */
  message?: string;
  /**
   * The short line Android's sheet shows above the message. iOS gets no
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
 * iOS has a native sheet with no ceiling on its rows. Android has none, and
 * RN's `Alert` is not a substitute: it keeps `buttons.slice(0, 3)`, so a fourth
 * row and the cancel behind it never reach the screen, and its dialog cannot be
 * dismissed by tapping outside it. So Android draws its own, in
 * `components/ui/ActionSheetHost`, which registers itself here because `lib/`
 * does not reach up into components.
 */
export function openActionSheet(sheet: SheetOptions): void {
  if (Platform.OS === 'ios') {
    const { message, cancelLabel = 'Cancel', rows } = sheet;
    // iOS reddens one row, the Android sheet every row that asks. No sheet has
    // two, so the platforms agree; a second destructive row would part them.
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

  presentOnAndroid?.(sheet);
}
