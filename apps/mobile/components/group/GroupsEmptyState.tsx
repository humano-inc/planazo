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
 * `JoinByCodeField` owns the case it exists for; this screen only claims the
 * placement, above the fold on the one screen everybody is guaranteed to see
 * (PLA-80).
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

      <JoinByCodeField />
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
