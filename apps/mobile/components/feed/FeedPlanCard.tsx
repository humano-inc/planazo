import { View, StyleSheet, Pressable } from 'react-native';
import { goingLabel, type PlanStatus, type PlanType, type RsvpResponse } from '@planazo/shared';
import {
  ThemedText,
  Card,
  Badge,
  AvatarStack,
  AnswerFooter,
  ButtonRow,
  DateOptionRow,
  PeopleGlyph,
  colorForName,
} from '../ui';
import { audienceLabel, type AudienceSource } from '../../lib/planAudience';
import { fmtDay } from '../../lib/dates';
import { waitingLabel } from '../../lib/rsvp';
import { colors, spacing } from '../../theme/tokens';

/**
 * The plan fields this card renders, not the whole `plans` row. The feed's
 * query selects far more than the card touches, and a local shape says which
 * columns removing would actually break it.
 */
interface FeedPlanRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  status: PlanStatus;
  plan_type: PlanType;
  min_people: number;
  /**
   * A group plan always carries its group: a plan with one is only readable
   * by members of that group, so the embed cannot be the row RLS hides. A
   * friends or friends-of-friends plan has none, and the slot says who it is
   * for instead (PLA-140).
   */
  groups: AudienceSource['groups'];
  audience: AudienceSource['audience'];
  plan_bridge?: AudienceSource['plan_bridge'];
}

/** One feed card's slice of the decorated plan the feed screen computes. */
interface FeedPlan {
  plan: FeedPlanRow;
  needs: boolean;
  confirmed: boolean;
  userRsvp?: { response: RsvpResponse | null };
  rsvpDriven: boolean;
  isFull: boolean;
  waitPosition: number | null;
  myDates: number;
  when: string;
  /** Everyone who has engaged — the faces. Wider than goingCount by design. */
  goingNames: string[];
  /** What min_people is measured against: the best single date, or yes-RSVPs. */
  goingCount: number;
  dateOptions: { id: string; date: string }[];
  countByDate: Record<string, { count: number; date: string }>;
}

interface FeedPlanCardProps {
  item: FeedPlan;
  /** The user's uncommitted date picks for this plan; state lives in the screen. */
  picked: string[];
  onTogglePicked: (planId: string, optionId: string) => void;
  onOpen: (planId: string) => void;
  onAnswer: (planId: string, response: RsvpResponse) => void;
  onClearAnswer: (planId: string) => void;
  onSendDates: (planId: string, optionIds: string[]) => void;
  onDecline: (planId: string, optionIds: string[]) => void;
}

export function FeedPlanCard({
  item,
  picked,
  onTogglePicked,
  onOpen,
  onAnswer,
  onClearAnswer,
  onSendDates,
  onDecline,
}: FeedPlanCardProps) {
  const { plan } = item;
  const context = audienceLabel(plan);
  const contextColor = context.color ?? colorForName(context.label);

  const renderAnswer = () => {
    // A called-off plan is a record — the notice above the feed carries it.
    if (plan.status === 'cancelled') return null;

    // Once a plan locks, the date is real and the vote is over, so a locked
    // flexible plan answers like a fixed one: a plain yes/no on your own row.
    // It has to stay reachable — locking seeds every available member into a
    // 'yes' they never tapped, and that's exactly when a clash shows up.
    if (item.rsvpDriven) {
      // The card stays dense: the position is the whole message, and the
      // promise behind it ("we'll tell you") lives on plan detail.
      if (item.userRsvp?.response === 'pending') {
        return (
          <AnswerFooter
            size="md"
            answered="pending"
            answerLabel={waitingLabel(item.waitPosition)}
            onChange={() => onClearAnswer(plan.id)}
          />
        );
      }
      if (item.userRsvp?.response === 'yes' || item.userRsvp?.response === 'no') {
        return (
          <AnswerFooter
            size="md"
            answered={item.userRsvp.response}
            onChange={() => onClearAnswer(plan.id)}
          />
        );
      }
      return (
        <AnswerFooter
          size="md"
          full={item.isFull}
          onYes={() => onAnswer(plan.id, 'yes')}
          onNo={() => onAnswer(plan.id, 'no')}
          onWait={() => onAnswer(plan.id, 'pending')}
        />
      );
    }

    // Flexible: answer inline — tap the dates that work, send them (2a)
    if (item.userRsvp?.response === 'no') {
      return <AnswerFooter size="md" answered="no" onChange={() => onClearAnswer(plan.id)} />;
    }
    if (item.myDates > 0) {
      return (
        <AnswerFooter
          size="md"
          answered="yes"
          answerLabel={`You sent ${item.myDates} date${item.myDates === 1 ? '' : 's'}`}
          onChange={() => onOpen(plan.id)}
        />
      );
    }

    return (
      <View style={styles.chips}>
        {item.dateOptions.map((opt) => (
          <DateOptionRow
            key={opt.id}
            label={fmtDay(opt.date)}
            meta={`${item.countByDate[opt.id]?.count ?? 0} free`}
            selected={picked.includes(opt.id)}
            onPress={() => onTogglePicked(plan.id, opt.id)}
            testID={`date-option-${opt.id}`}
          />
        ))}
        <ButtonRow
          size="md"
          style={styles.chipButtons}
          secondary={{
            label: "Can't make it",
            variant: 'secondary',
            onPress: () =>
              onDecline(plan.id, item.dateOptions.map((o) => o.id)),
          }}
          primary={
            picked.length === 0
              ? {
                  label: 'Choose dates',
                  variant: 'secondary',
                  disabled: true,
                  haptic: false,
                }
              : {
                  label: `Send ${picked.length} date${picked.length === 1 ? '' : 's'}`,
                  onPress: () => onSendDates(plan.id, picked),
                }
          }
        />
      </View>
    );
  };

  return (
    <Card stripeColor={contextColor} testID={`plan-card-${plan.id}`}>
      <Pressable onPress={() => onOpen(plan.id)}>
        <View style={styles.cardTop}>
          <View style={styles.groupRow}>
            {context.people ? (
              <View style={[styles.swatch, styles.peopleTile]} testID="plan-card-people">
                <PeopleGlyph />
              </View>
            ) : (
              <View style={[styles.swatch, { backgroundColor: contextColor }]} />
            )}
            <ThemedText
              variant="caption"
              color={colors.textSecondary}
              numberOfLines={1}
              style={styles.contextLabel}
            >
              {context.label}
            </ThemedText>
          </View>
          {/*
            Two independent facts share one slot, so the label has
            to pick. "Unanswered" is the one that is always true
            when it shows: a plan with its numbers can still be
            waiting on your reply, and the old "Needs you" claimed
            the plan was short of people when often it was not.
          */}
          <Badge
            label={item.needs ? 'Unanswered' : item.confirmed ? 'Confirmed' : 'Open'}
            tone={item.needs ? 'open' : item.confirmed ? 'confirmed' : 'muted'}
          />
        </View>

        <ThemedText variant="cardTitle" style={styles.title}>
          {plan.title}
        </ThemedText>
        <ThemedText variant="bodyStrong">{item.when}</ThemedText>
        {plan.location || plan.description ? (
          <ThemedText variant="sub" numberOfLines={1} style={styles.sub}>
            {plan.location ?? plan.description}
          </ThemedText>
        ) : null}

        {item.goingNames.length > 0 && !(plan.plan_type === 'flexible' && item.needs) ? (
          <View style={styles.faces}>
            <AvatarStack
              names={item.goingNames}
              label={goingLabel(item.goingCount, plan.min_people)}
            />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.answer}>{renderAnswer()}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  // "Friends of friends · via Marta García" is the longest thing this slot
  // holds; it yields to the badge rather than pushing it off the card.
  contextLabel: {
    flexShrink: 1,
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 6,
  },
  peopleTile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  title: {
    marginBottom: spacing.xs,
  },
  sub: {
    marginTop: spacing.xxs,
  },
  faces: {
    marginTop: spacing.md,
  },
  answer: {
    marginTop: spacing.md,
  },
  chips: {
    gap: spacing.sm,
  },
  chipButtons: {
    marginTop: spacing.xxs,
  },
});
