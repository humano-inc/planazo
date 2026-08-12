import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

/**
 * Shared by every settings card on Manage, switch rows and pressable rows
 * alike: the cards stack directly on top of each other, so a card that styled
 * its own rows would have to be corrected in five files to keep looking like
 * its neighbours.
 *
 * Its own file rather than an export from `PrefSwitchRow`, where it used to
 * live: five siblings import it, and only one of them wants the row component.
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
