import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { setActionSheetPresenter, type SheetOptions, type SheetRow } from '../../lib/actionSheet';
import { ThemedText } from './ThemedText';
import { colors, spacing } from '../../theme/tokens';

/**
 * Draws `openActionSheet` on Android, where the platform has no such sheet.
 *
 * Mounted once at the root, above the router, so that any screen can open one.
 * It renders nothing on iOS because nothing ever presents to it there.
 *
 * `Modal` is what makes it a sheet you can always leave: the back button and the
 * dimmed area both close it, the same as the cancel row.
 */
export function ActionSheetHost() {
  const [sheet, setSheet] = useState<SheetOptions | null>(null);

  useEffect(() => setActionSheetPresenter((next) => setSheet(next)), []);

  if (!sheet) return null;

  const close = () => setSheet(null);

  // Closed first: a row can open the camera or push a screen, and neither
  // should come up underneath a sheet that is still on its way out.
  const choose = (row: SheetRow) => {
    close();
    void row.run();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
      testID="action-sheet-modal"
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={sheet.cancelLabel ?? 'Cancel'}
          testID="action-sheet-backdrop"
        />
        <View style={styles.sheet} accessibilityViewIsModal testID="action-sheet">
          <View style={styles.heading}>
            <ThemedText variant="cardTitle">{sheet.androidTitle}</ThemedText>
            {sheet.message ? (
              <ThemedText variant="body" color={colors.textSecondary}>
                {sheet.message}
              </ThemedText>
            ) : null}
          </View>
          {sheet.rows.map((row) => (
            <Pressable
              key={row.label}
              onPress={() => choose(row)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <ThemedText
                variant="bodyStrong"
                color={row.destructive ? colors.accentText : undefined}
              >
                {row.label}
              </ThemedText>
            </Pressable>
          ))}
          <Pressable
            onPress={close}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, styles.cancel, pressed && styles.pressed]}
          >
            <ThemedText variant="bodyStrong" color={colors.textSecondary}>
              {sheet.cancelLabel ?? 'Cancel'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23,18,21,0.42)',
    justifyContent: 'flex-end',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  heading: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  cancel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
});
