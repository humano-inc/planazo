import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { ThemedText, Badge, Button, Card, colorForName } from '../ui';
import type { FeedPollItem } from '../../lib/feedPolls';
import type { FeedPollTransition } from '../../lib/useFeedPollVoteTransition';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { colors, fonts, radii, spacing } from '../../theme/tokens';

interface FeedPollCardProps {
  item: FeedPollItem;
  transition?: FeedPollTransition;
  onOpen: (planId: string) => void;
  onSendVote: (optionId: string) => void;
}

function voteLabel(votes: number): string {
  return votes === 1 ? '1 vote' : `${votes} votes`;
}

export function FeedPollCard({ item, transition, onOpen, onSendVote }: FeedPollCardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const groupColor = item.groupColor ?? colorForName(item.groupName);
  const transitioning = transition !== undefined;
  const chosenOptionId = transition?.optionId ?? selectedOptionId;
  const status = transition?.phase === 'saved' ? 'Vote saved' : 'Saving your vote';

  return (
    <Card style={styles.card} testID={`poll-card-${item.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.planTitle}`}
        onPress={() => onOpen(item.planId)}
        style={({ pressed }) => [styles.context, pressed && styles.contextPressed]}
        testID={`poll-card-plan-${item.planId}`}
      >
        <View style={styles.identity}>
          <View style={[styles.swatch, { backgroundColor: groupColor }]} />
          <ThemedText variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {item.groupName}
          </ThemedText>
        </View>
        <Badge
          label="Poll"
          tone="custom"
          bg={colors.surface}
          fg={colors.accentText}
          uppercase
        />
      </Pressable>

      <ThemedText variant="caption" color={colors.accentText} numberOfLines={1}>
        For {item.planTitle}
      </ThemedText>
      <ThemedText variant="cardTitle" style={styles.question}>
        {item.question}
      </ThemedText>

      <View style={styles.options}>
        {item.options.map((option) => {
          const selected = chosenOptionId === option.id;
          const submitted = transitioning && selected;
          const tally = voteLabel(option.votes + (submitted ? 1 : 0));
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}, ${tally}${selected ? ', your pick' : ''}`}
              accessibilityHint={
                transitioning
                  ? undefined
                  : selected
                    ? 'Deselect this option'
                    : 'Select this option'
              }
              accessibilityState={{ disabled: transitioning, selected }}
              disabled={transitioning}
              onPress={() =>
                setSelectedOptionId((current) => (current === option.id ? null : option.id))
              }
              style={({ pressed }) => [
                styles.option,
                transitioning && !selected && styles.optionMuted,
                selected && !transitioning && styles.optionChosen,
                submitted && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
              testID={`poll-card-option-${option.id}`}
            >
              <ThemedText style={[styles.optionLabel, submitted && styles.optionLabelSelected]}>
                {option.label}
              </ThemedText>
              <View style={styles.optionMeta}>
                <ThemedText
                  variant="caption"
                  color={submitted ? colors.textOnAccent : selected ? colors.accentText : colors.textMuted}
                >
                  {tally}
                </ThemedText>
                {selected ? (
                  <Animated.View
                    entering={ZoomIn.duration(180).reduceMotion(ReduceMotion.System)}
                    style={[styles.check, !submitted && styles.checkChosen]}
                    testID={`poll-card-check-${option.id}`}
                  >
                    <ThemedText variant="tag" color={colors.accentText}>
                      ✓
                    </ThemedText>
                  </Animated.View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <ThemedText variant="caption" color={colors.accentText}>
          {item.caption}
        </ThemedText>
        <ThemedText variant="caption" color={colors.textSecondary}>
          {transitioning ? 'Your pick' : selectedOptionId ? 'Ready to send' : 'Pick one'}
        </ThemedText>
      </View>

      {transitioning ? (
        <View style={styles.actionStatus} testID={`poll-card-status-${item.id}`}>
          <ThemedText variant="bodyStrong" color={colors.accentText}>
            {status}
          </ThemedText>
          {transition.phase === 'saved' ? (
            <ThemedText variant="bodyStrong" color={colors.accentText}>
              ✓
            </ThemedText>
          ) : null}
        </View>
      ) : (
        <Button
          label={selectedOptionId ? 'Send vote' : 'Choose one'}
          size="md"
          variant={selectedOptionId ? 'primary' : 'secondary'}
          disabled={!selectedOptionId}
          haptic={selectedOptionId !== null}
          onPress={() => selectedOptionId && onSendVote(selectedOptionId)}
          style={styles.action}
          testID={`poll-card-send-${item.id}`}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.borderStrong,
  },
  context: {
    minHeight: MIN_TOUCH_TARGET,
    marginTop: -spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  contextPressed: {
    opacity: 0.7,
  },
  identity: {
    minWidth: 0,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 6,
  },
  question: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radii.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  optionPressed: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.accent,
  },
  optionMuted: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.borderStrong,
  },
  optionChosen: {
    borderColor: colors.accentPressed,
    borderWidth: 1.5,
  },
  optionSelected: {
    backgroundColor: colors.accentPressed,
    borderColor: colors.accentPressed,
  },
  optionLabel: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 20,
  },
  optionLabelSelected: {
    color: colors.textOnAccent,
  },
  optionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkChosen: {
    backgroundColor: colors.accentSoft,
  },
  footer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  action: {
    marginTop: spacing.sm,
  },
  actionStatus: {
    minHeight: MIN_TOUCH_TARGET,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.row,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
