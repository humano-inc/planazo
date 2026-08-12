import { StyleSheet, TextInput, View } from 'react-native';
import { GroupTile } from '../ui';
import { colors, fonts, spacing } from '../../theme/tokens';

interface Props {
  name: string;
  color: string | null;
  /** A set photo takes the tile over; the letter is the default. */
  imageUrl?: string | null;
  onChangeName: (name: string) => void;
}

/**
 * The tile and the name field, side by side: the first thing both group forms
 * ask for, and the one that shows its own answer back as you type (PLA-117).
 *
 * The tile's placeholder is derived here rather than passed in, because the
 * two screens computed the same `name.trim().length > 0` under different names
 * and a form that showed a different placeholder from its sibling would be a
 * bug nobody asked for.
 */
export function GroupNameRow({ name, color, imageUrl, onChangeName }: Props) {
  return (
    <View style={styles.row}>
      <GroupTile name={name.trim() ? name : '?'} color={color} imageUrl={imageUrl} size={52} />
      <View style={styles.block}>
        <TextInput
          style={styles.input}
          placeholder="Name the group"
          placeholderTextColor={colors.textFaint}
          value={name}
          onChangeText={onChangeName}
          testID="name-input"
        />
        <View style={styles.rule} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  block: {
    flex: 1,
    gap: spacing.sm,
  },
  input: {
    fontFamily: fonts.displayHeavy,
    fontSize: 26,
    letterSpacing: -0.52,
    color: colors.textPrimary,
    padding: 0,
  },
  rule: {
    height: 2,
    backgroundColor: colors.borderStrong,
  },
});
