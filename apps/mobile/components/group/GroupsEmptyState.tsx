import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { GroupTiles } from './GroupTiles';
import { JoinByCodeField } from './JoinByCodeField';
import { ThemedText, Button } from '../ui';
import { colors, spacing } from '../../theme/tokens';

/**
 * 16a: two ways in, and they're not equal — the link field is real,
 * creating is second, and the header pill stays gone.
 *
 * This is also where somebody lands when the store broke the chain: they tapped
 * an invite, installed from it, and arrived with no memory of the code. The
 * field is the way back in for them, which is why it sits above the fold on the
 * one screen they are guaranteed to see (PLA-80).
 */
export function GroupsEmptyState() {
  const router = useRouter();

  return (
    <View style={styles.empty}>
      <GroupTiles />
      <ThemedText variant="headerTitle" style={styles.emptyTitle}>
        A group is just{'\n'}your group of people
      </ThemedText>
      <ThemedText variant="body" color={colors.textSecondary}>
        Flatmates, the padel lot, the ones who actually turn up. Plans you make go to one
        group, not to everybody.
      </ThemedText>

      <JoinByCodeField style={styles.joinField} />
      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <ThemedText variant="caption" color={colors.textFaint}>
          or
        </ThemedText>
        <View style={styles.orLine} />
      </View>
      <Button
        label="Create a group"
        variant="ink"
        onPress={() => router.push('/(app)/group/new')}
        testID="create-group"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
    gap: spacing.sm,
  },
  emptyTitle: {
    paddingTop: spacing.xs,
  },
  joinField: {
    marginTop: spacing.lg,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.xxs,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.tabBarBorder,
  },
});
