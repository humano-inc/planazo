import { StyleSheet, View } from 'react-native';
import { Avatar, ThemedText } from '../ui';
import { timeAgo } from '../../lib/dates';
import { commentAuthorLabel, type PlanComment } from '../../lib/planComments';
import { colors, spacing } from '../../theme/tokens';

interface Props {
  comment: PlanComment;
  userId: string | undefined;
  /** The plan-detail card clips a long comment. The comments screen shows all of it. */
  numberOfLines?: number;
}

/** Who said it, when, and what they said. Same row on the card and the screen. */
export function CommentRow({ comment, userId, numberOfLines }: Props) {
  return (
    <View style={styles.row}>
      <Avatar
        name={comment.author.display_name}
        imageUrl={comment.author.avatar_url}
        size={AVATAR_SIZE}
      />
      <View style={styles.text}>
        <View style={styles.meta}>
          <ThemedText variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {commentAuthorLabel(comment, userId)}
          </ThemedText>
          <ThemedText variant="caption" color={colors.textMuted}>
            {timeAgo(comment.created_at)}
          </ThemedText>
        </View>
        <ThemedText variant="body" numberOfLines={numberOfLines}>
          {comment.body}
        </ThemedText>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 32;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  // Gives way to the time, which is short and fixed, when a name runs long.
  name: {
    flexShrink: 1,
  },
});
