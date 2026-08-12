import { Pressable, StyleSheet, View } from 'react-native';
import { countPollVotes, pollLeaders, pollVotedPhrase } from '@planazo/shared';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { AvatarStack, Badge, DisclosureGlyph, ThemedText } from '../ui';
import { type PlanPollRow } from '../../lib/usePlanPoll';
import { colors, spacing } from '../../theme/tokens';

/**
 * One question of a plan's polls (PLA-47), folding to a single row with the
 * two facts worth keeping: what is leading, and where you stand. Several polls
 * on one plan is a scroll problem, which is what the fold is for.
 *
 * Everything here is a function of `poll` and `userId`: the votes arrive with
 * the poll, so counting them is local work and no row fetches anything.
 */
export function PollSection({
  poll,
  userId,
  peopleIn,
  live,
  expanded,
  onToggle,
  onPick,
}: {
  poll: PlanPollRow;
  userId: string;
  /** The denominator of "3 of 5 voted" and of every option's bar. */
  peopleIn: number;
  /** The viewer holds a pick and the plan is still running. */
  live: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPick: (optionId: string, mine: boolean) => void;
}) {
  const options = [...poll.plan_poll_options].sort((a, b) => a.position - b.position);
  const votes = poll.plan_poll_votes;
  const counts = countPollVotes(options, votes);
  const { leaders, maxVotes } = pollLeaders(options, votes);
  const leadId = leaders[0]?.id ?? null;
  const votedCount = votes.length;
  const myOptionId = votes.find((v) => v.user_id === userId)?.option_id ?? null;
  const myPick = options.find((o) => o.id === myOptionId) ?? null;

  const caption = pollVotedPhrase(votedCount, peopleIn);

  const namesFor = (optionId: string) =>
    votes
      .filter((v) => v.option_id === optionId)
      .map((v) => (v.user_id === userId ? 'You' : v.profile?.display_name ?? '?'))
      // You first, the way the going row leads with you.
      .sort((a, b) => (a === 'You' ? -1 : b === 'You' ? 1 : 0));

  return (
    <View style={styles.section} testID={`poll-section-${poll.id}`}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        testID={`poll-toggle-${poll.id}`}
        style={styles.header}
      >
        <ThemedText variant="sectionLabel" style={styles.headerLabel} numberOfLines={1}>
          {poll.question}
        </ThemedText>
        <View style={styles.headerMeta}>
          <ThemedText variant="caption" color={colors.textMuted}>
            {caption}
          </ThemedText>
          <DisclosureGlyph expanded={expanded} color={colors.accentText} />
        </View>
      </Pressable>

      {!expanded ? (
        // Folded: the two facts worth keeping — what's leading, where you stand.
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          testID={`poll-lead-${poll.id}`}
          style={styles.leadRow}
        >
          <View style={styles.leadLeft}>
            <ThemedText variant="bodyStrong" style={styles.optionLabel} numberOfLines={1}>
              {leaders[0]?.label ?? 'Nothing yet'}
            </ThemedText>
            {leadId ? <Badge label="Leading" tone="muted" uppercase /> : null}
          </View>
          {live ? (
            <ThemedText variant="caption" color={colors.textMuted} numberOfLines={1}>
              {myPick ? `You picked ${myPick.label}` : "You haven't voted"}
            </ThemedText>
          ) : null}
        </Pressable>
      ) : (
        <>
          {options.map((opt) => {
            const mine = opt.id === myOptionId;
            const count = counts[opt.id] ?? 0;
            const names = namesFor(opt.id);
            const ratio = peopleIn > 0 ? Math.min(count / peopleIn, 1) : 0;
            return (
              <Pressable
                key={opt.id}
                disabled={!live}
                onPress={() => onPick(opt.id, mine)}
                accessibilityRole={live ? 'button' : undefined}
                accessibilityState={{ selected: mine, disabled: !live }}
                accessibilityLabel={`${opt.label}, ${count} ${count === 1 ? 'vote' : 'votes'}`}
                testID={`poll-option-${opt.id}`}
                style={[styles.optionRow, !live && styles.optionRowQuiet, mine && styles.optionRowMine]}
              >
                <View style={styles.optionTop}>
                  <View style={styles.optionLeft}>
                    <ThemedText
                      variant="bodyStrong"
                      color={
                        mine
                          ? colors.accentPressed
                          : live
                            ? colors.textPrimary
                            : colors.textSecondary
                      }
                      style={styles.optionLabel}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </ThemedText>
                    {opt.id === leadId ? <Badge label="Leading" tone="muted" uppercase /> : null}
                  </View>
                  <View style={styles.optionMeta}>
                    <ThemedText
                      variant="caption"
                      color={mine ? colors.accentPressed : colors.textMuted}
                      testID={`poll-count-${opt.id}`}
                    >
                      {count === 1 ? '1 vote' : `${count} votes`}
                    </ThemedText>
                    <ThemedText variant="bodyStrong" color={colors.accent} style={styles.mark}>
                      {mine ? '✓' : ''}
                    </ThemedText>
                  </View>
                </View>
                {live && names.length > 0 ? <AvatarStack names={names} size={22} /> : null}
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.round(ratio * 100)}%`,
                        backgroundColor: live ? colors.accent : colors.textFaint,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
          <ThemedText variant="caption" color={colors.textMuted} style={styles.footnote}>
            {!live
              ? "Say you're in and you get a pick."
              : maxVotes === 0
                ? 'Be the first. One pick each, changeable any time.'
                : 'One pick each. Tap another to change it. The poll stays open as long as the plan does.'}
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  headerLabel: {
    flexShrink: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leadRow: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  leadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  optionRow: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.lg,
    gap: 9,
  },
  optionRowQuiet: {
    backgroundColor: colors.surfaceSunken,
    borderColor: 'transparent',
  },
  optionRowMine: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
    flexShrink: 1,
  },
  optionLabel: {
    fontSize: 16,
    flexShrink: 1,
  },
  optionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mark: {
    width: 14,
    textAlign: 'center',
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 999,
  },
  footnote: {
    lineHeight: 19,
  },
});
