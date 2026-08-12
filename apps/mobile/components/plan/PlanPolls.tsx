import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { ThemedText } from '../ui';
import { PollSection } from './PollSection';
import { usePlanPolls, useVotePlanPoll } from '../../lib/usePlanPoll';
import { colors, spacing } from '../../theme/tokens';

interface Props {
  planId: string;
  userId: string;
  /** Host or group admin: sees the add-a-poll invitation. */
  isHost: boolean;
  /**
   * How many people are in the plan — the denominator of "3 of 5 voted" and
   * of every option's bar.
   */
  peopleIn: number;
  /**
   * Whether the viewer holds a pick: in the plan, or its host. Everyone in
   * the group reads the tally; only the people going get a vote, which makes
   * the poll one more reason to answer.
   */
  canVote: boolean;
  /** Cancelled or past: the tally stays as the record, but nothing moves. */
  planEnded: boolean;
}

/**
 * The polls a plan carries (PLA-47): one `PollSection` per question, plus the
 * host's invitation to add another. One pick each, tap another to move it, tap
 * your own to drop it, and the tally just runs: nothing closes it, the poll
 * lives as long as the plan.
 *
 * Owns the query and the vote mutation, like PhotoAlbumCard, so the detail
 * screen carries a feature rather than its plumbing.
 */
export function PlanPolls({ planId, userId, isHost, peopleIn, canVote, planEnded }: Props) {
  const router = useRouter();
  const { data: polls, isLoading } = usePlanPolls(planId);
  const vote = useVotePlanPoll();
  // Which sections are unfolded. Unvisited polls fall back to "first one
  // open, the rest folded", the reading order the design settles on.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (isLoading) return null;
  const list = polls ?? [];
  const showAdd = isHost && !planEnded;
  if (list.length === 0 && !showAdd) return null;

  const live = canVote && !planEnded;

  return (
    <View style={styles.sections}>
      {list.map((poll, index) => {
        const expanded = open[poll.id] ?? index === 0;
        return (
          <PollSection
            key={poll.id}
            poll={poll}
            userId={userId}
            peopleIn={peopleIn}
            live={live}
            expanded={expanded}
            onToggle={() => setOpen((o) => ({ ...o, [poll.id]: !expanded }))}
            onPick={(optionId, mine) =>
              vote.mutate({ planId, pollId: poll.id, userId, optionId: mine ? null : optionId })
            }
          />
        );
      })}

      {showAdd ? (
        <Pressable
          // peopleIn rides along so the sheet's "The 5 who are in" row costs
          // no second fetch — this card is the sheet's only entry point.
          onPress={() => router.push(`/plan/${planId}/poll?peopleIn=${peopleIn}`)}
          accessibilityRole="button"
          testID="poll-add"
          style={styles.addCard}
        >
          <ThemedText variant="bodyStrong" color={colors.accentText}>
            {list.length === 0 ? '+ Add a poll' : '+ Add another poll'}
          </ThemedText>
          <ThemedText variant="caption" color={colors.textMuted} style={styles.addHint}>
            {list.length === 0
              ? 'Let them pick the film, the place, who brings what'
              : 'Only you can add one'}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: spacing.lg,
  },
  addCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  addHint: {
    textAlign: 'center',
    lineHeight: 19,
  },
});
