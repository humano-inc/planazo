import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ForwardGlyph, ThemedText } from '../ui';
import { CommentRow } from './CommentRow';
import { commentCountLabel, commentsCardState } from '../../lib/planComments';
import { errorCopy } from '../../lib/queryErrors';
import { usePlanCommentsCard } from '../../lib/usePlanComments';
import { colors, radii, spacing } from '../../theme/tokens';

/** How much of a comment the card shows before the screen shows the rest. */
const PREVIEW_LINES = 2;

interface Props {
  planId: string;
  userId: string;
  isCancelled: boolean;
}

/**
 * The conversation on a plan, seen from the plan: the latest two comments and how
 * many there are. Writing happens one tap away, because this screen's footer is
 * already taken by the RSVP actions (PLA-152).
 */
export function PlanCommentsCard({ planId, userId, isCancelled }: Props) {
  const router = useRouter();
  const { card, isError, error } = usePlanCommentsCard(planId);
  const state = commentsCardState(card?.total, isCancelled);

  // A failed read is not an empty conversation, and inviting someone to start one
  // would be a false thing to say about a plan people may be talking on.
  if (isError && !card) {
    return (
      <View style={styles.section}>
        <ThemedText variant="sectionLabel">Comments</ThemedText>
        <View style={[styles.card, styles.summary]}>
          <ThemedText variant="body" color={colors.textSecondary}>
            {errorCopy(error).title}
          </ThemedText>
        </View>
      </View>
    );
  }

  if (state === 'hidden' || !card) return null;

  return (
    <View style={styles.section}>
      <ThemedText variant="sectionLabel">Comments</ThemedText>

      <Pressable
        onPress={() => router.push(`/plan/${planId}/comments`)}
        accessibilityRole="button"
        accessibilityLabel={
          state === 'invite'
            ? 'Add the first comment'
            : `Open the comments, ${commentCountLabel(card.total)}`
        }
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        testID="comments-card"
      >
        {state === 'invite' ? (
          <View style={styles.body}>
            <ThemedText variant="body" color={colors.textSecondary}>
              Ask what time, or say what you're bringing.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.body}>
            {card.latest.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                userId={userId}
                numberOfLines={PREVIEW_LINES}
              />
            ))}
          </View>
        )}

        <View style={[styles.summary, styles.divided]}>
          <ThemedText variant="bodyStrong">
            {state === 'invite' ? 'Add the first comment' : commentCountLabel(card.total)}
          </ThemedText>
          <ForwardGlyph color={colors.textFaint} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  pressed: {
    backgroundColor: colors.surfaceSunken,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divided: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});
