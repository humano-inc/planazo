import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

/**
 * Every settings card on Manage draws its rows from here, switch rows and
 * pressable rows alike. The cards stack directly on top of each other, so a
 * card that styles its own rows drifts from the one above it.
 *
 * Its own file rather than an export from `PrefSwitchRow`, where it used to
 * live: a card that wants the styles usually does not want the row component,
 * and importing a component to reach a stylesheet reads as a mistake.
 */
export const settingsStyles = StyleSheet.create({
  section: {
    gap: 10,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    padding: spacing.lg,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  note: {
    paddingHorizontal: spacing.xs,
  },
});
