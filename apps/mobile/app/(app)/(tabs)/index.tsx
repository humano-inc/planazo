import { useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  canVoteOnPolls,
  countAvailabilityByDate,
  earliestViableDate,
  flattenNestedOptions,
  isPlanConfirmed,
  isPlanFull,
  isPlanPast,
  isVoteRunning,
  needsUserResponse,
  planGoingCount,
  planGoingPeople,
  pollPeopleIn,
  waitlistPosition,
} from '@planazo/shared';
import { supabase } from '../../../lib/supabase';
import { fmtDay, fmtTime } from '../../../lib/dates';
import { useFeedAnswers } from '../../../lib/useFeedAnswers';
import { useCancelNotices } from '../../../lib/useCancelNotices';
import { useMyGroups } from '../../../lib/useMyGroups';
import { errorCopy } from '../../../lib/queryErrors';
import { usePullToRefresh } from '../../../lib/usePullToRefresh';
import { deriveFeedPollItems } from '../../../lib/feedPolls';
import { useFeedPollVoteTransition } from '../../../lib/useFeedPollVoteTransition';
import { MIN_TOUCH_TARGET } from '../../../lib/a11y';
import { useAuthStore } from '../../../stores/authStore';
import { ThemedText, Chip, Avatar, EmptyState, ErrorState } from '../../../components/ui';
import { FeedPlanCard } from '../../../components/feed/FeedPlanCard';
import { FeedPollCard } from '../../../components/feed/FeedPollCard';
import { CancelNotices } from '../../../components/feed/CancelNotices';
import { NeedsGroupState } from '../../../components/group/NeedsGroupState';
import { colors, spacing } from '../../../theme/tokens';

type Filter = 'all' | 'needs' | 'happening';

export default function FeedScreen() {
  const { profile, user } = useAuthStore();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  // Local date selections per flexible plan, committed on "Send N dates"
  const [pickedDates, setPickedDates] = useState<Record<string, string[]>>({});
  const reducedMotion = useReducedMotion();

  const { data: plans, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['home-plans', user?.id],
    queryFn: async () => {
      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user?.id);

      if (memberError) throw memberError;
      const groupIds = memberships.map((m) => m.group_id);
      if (groupIds.length === 0) return [];

      const { data, error } = await supabase
        .from('plans')
        .select(
          // lib/pollVoteCache.ts patches the plan_polls embed optimistically
          // on a vote. The current vote makes its poll item disappear before
          // the receipt trigger and settle-time refetch arrive, so keep this
          // nested shape in step with that cache edit.
          `*,
          groups(id, name, color),
          rsvps(user_id, response, waitlist_seq, profile:profiles(display_name)),
          plan_date_options(id, date, date_availability(user_id, profile:profiles(display_name))),
          plan_polls(id, question, created_at, plan_poll_options!plan_poll_options_poll_id_plan_id_fkey(id, label, position), plan_poll_votes(option_id, user_id), plan_poll_vote_receipts(user_id))`
        )
        .in('group_id', groupIds)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  // An empty feed means two different things, and the plans query cannot tell
  // them apart: it returns [] for "no groups" before it ever asks about plans.
  // Only one of the two is the user's problem to solve (PLA-68).
  const { hasGroups, loading: groupsLoading } = useMyGroups();

  const { notices, dismiss } = useCancelNotices();

  const answers = useFeedAnswers({
    onDatesSent: (planId) => setPickedDates((prev) => ({ ...prev, [planId]: [] })),
  });

  const decorated = useMemo(() => {
    return (plans ?? []).map((plan: any) => {
      const { dateOptions, availabilities } = flattenNestedOptions(plan.plan_date_options);
      const planData = {
        plan_type: plan.plan_type,
        status: plan.status,
        min_people: plan.min_people,
        rsvps: plan.rsvps,
        dateOptions,
        availabilities,
      };
      const confirmed = isPlanConfirmed(planData);
      const needs = needsUserResponse(planData, user?.id);
      const userRsvp = (plan.rsvps ?? []).find((r: any) => r.user_id === user?.id);
      const myDates = availabilities.filter((a) => a.user_id === user?.id).length;
      const countByDate = countAvailabilityByDate(dateOptions, availabilities);
      // No live vote — either there never was one, or locking ended it. What
      // you can answer follows the same line as who counts, so the card's
      // footer and its numbers can never describe two different plans.
      const rsvpDriven = !isVoteRunning(planData);

      let when: string;
      if (plan.locked_date) {
        when = `${fmtDay(plan.locked_date)} · ${fmtTime(plan.locked_date)}`;
      } else if (plan.event_date) {
        when = `${fmtDay(plan.event_date)} · ${fmtTime(plan.event_date)}`;
      } else {
        when = `${dateOptions.length} date${dateOptions.length === 1 ? '' : 's'} on the table`;
      }

      // Two different populations, on purpose. The faces are everyone who has
      // engaged, so someone who withdraws actually leaves the stack. The number
      // beside min_people is the best single date, because that is what decides
      // whether the plan is on. Three faces beside "1 of 3 needed" is honest.
      const goingCount = planGoingCount(planData);
      const goingNames = planGoingPeople(planData).map((p) => p.name);

      const sortDate =
        plan.locked_date ?? plan.event_date ?? earliestViableDate(countByDate, plan.min_people);

      // 19e: Plans only ever holds things that still need you — expired and
      // past-confirmed plans leave silently at the end of their day.
      const isPast = isPlanPast(plan, dateOptions.map((o) => o.date));

      // Every place taken (PLA-20). Only asked while a yes is what the plan
      // wants — a running vote hands out no seats until it locks.
      const isFull = rsvpDriven && isPlanFull({ max_people: plan.max_people, rsvps: plan.rsvps });

      // Only you see your own place in the queue (PLA-37).
      const waitPosition = waitlistPosition(plan.rsvps, user?.id);

      return {
        plan,
        isPast,
        confirmed,
        needs,
        userRsvp,
        rsvpDriven,
        isFull,
        waitPosition,
        myDates,
        when,
        goingNames,
        goingCount,
        dateOptions,
        countByDate,
        canVoteOnPolls: canVoteOnPolls(
          { created_by: plan.created_by, rsvps: plan.rsvps, availabilities },
          user?.id
        ),
        pollPeopleIn: pollPeopleIn(plan.rsvps, availabilities),
        sortKey: sortDate ? new Date(sortDate).getTime() : Number.MAX_SAFE_INTEGER,
      };
    });
  }, [plans, user?.id]);

  const pollItems = useMemo(
    () =>
      deriveFeedPollItems(
        decorated.map((item) => ({
          planId: item.plan.id,
          planTitle: item.plan.title,
          groupName: item.plan.groups?.name ?? 'Group',
          groupColor: item.plan.groups?.color,
          isPast: item.isPast,
          canVote: item.canVoteOnPolls,
          peopleIn: item.pollPeopleIn,
          polls: item.plan.plan_polls,
        })),
        user?.id
      ),
    [decorated, user?.id]
  );

  const visible = useMemo(() => {
    const filtered = decorated.filter(
      (d) =>
        !d.isPast && (filter === 'needs' ? d.needs : filter === 'happening' ? d.confirmed : true)
    );
    return filtered.sort((a, b) =>
      a.needs !== b.needs ? (a.needs ? -1 : 1) : a.sortKey - b.sortKey
    );
  }, [decorated, filter]);

  const {
    sendPollVote,
    transitions: pollTransitions,
    visiblePolls,
  } = useFeedPollVoteTransition(pollItems, user?.id, filter !== 'happening');
  const hasVisibleItems = visible.length > 0 || visiblePolls.length > 0;

  const pollExit = reducedMotion
    ? FadeOut.duration(160).reduceMotion(ReduceMotion.Never)
    : FadeOutUp.duration(220)
        .easing(Easing.out(Easing.exp))
        .reduceMotion(ReduceMotion.System);
  const feedLayout = reducedMotion
    ? undefined
    : LinearTransition.duration(260)
        .easing(Easing.out(Easing.exp))
        .reduceMotion(ReduceMotion.System);

  const openPlan = (planId: string) => router.push(`/(app)/plan/${planId}`);

  const togglePicked = (planId: string, optionId: string) =>
    setPickedDates((prev) => {
      const picked = prev[planId] ?? [];
      return {
        ...prev,
        [planId]: picked.includes(optionId)
          ? picked.filter((id) => id !== optionId)
          : [...picked, optionId],
      };
    });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <ThemedText variant="headerTitle">Planazo</ThemedText>
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          testID="feed-avatar"
          style={styles.avatarAction}
        >
          <Avatar name={profile?.display_name ?? '?'} dark size={36} imageUrl={profile?.avatar_url} />
        </Pressable>
      </View>

      <View style={styles.filters}>
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Unanswered" active={filter === 'needs'} onPress={() => setFilter('needs')} />
        <Chip
          label="Happening"
          active={filter === 'happening'}
          onPress={() => setFilter('happening')}
        />
      </View>

      {/* Both queries, or the feed shows one empty state and swaps it for the
          other a moment later. */}
      {isLoading || groupsLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : isError ? (
        // Still a ScrollView so pull-to-refresh survives: the old spinner replaced
        // the whole list, leaving a stuck feed no way out but a relaunch (PLA-15).
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.errorContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <ErrorState {...errorCopy(error)} onRetry={() => refetch()} testID="feed-error" />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <CancelNotices notices={notices} onDismiss={dismiss} />

          {!hasVisibleItems && !hasGroups ? (
            // Sending this user to the create sheet was the loop PLA-68 is
            // about: the one action offered was the one thing they could not
            // do. A filter they cannot have set yet is not worth a branch —
            // with no groups there are no plans to filter.
            <NeedsGroupState testID="feed-needs-group" />
          ) : !hasVisibleItems ? (
            <EmptyState
              title={filter === 'needs' ? 'Nothing to answer' : 'Nothing on the table'}
              body={
                filter === 'needs'
                  ? 'When someone in a group proposes a plan, it lands here.'
                  : 'Start something. Pick a group, throw out a date or a few, and see who bites.'
              }
              ctaLabel="Start a plan"
              onPress={() => router.push('/(app)/plan/create')}
            />
          ) : (
            <>
              {visiblePolls.map((poll) => (
                <Animated.View
                  key={poll.id}
                  layout={feedLayout}
                  exiting={pollExit}
                  testID={`poll-card-motion-${poll.id}`}
                >
                  <FeedPollCard
                    item={poll}
                    transition={pollTransitions[poll.id]}
                    onOpen={openPlan}
                    onSendVote={(optionId) => sendPollVote(poll, optionId)}
                  />
                </Animated.View>
              ))}
              {visible.map((d) => (
                <Animated.View key={d.plan.id} layout={feedLayout}>
                  <FeedPlanCard
                    item={d}
                    picked={pickedDates[d.plan.id] ?? []}
                    onTogglePicked={togglePicked}
                    onOpen={openPlan}
                    onAnswer={answers.answer}
                    onClearAnswer={answers.clearAnswer}
                    onSendDates={answers.sendDates}
                    onDecline={answers.decline}
                  />
                </Animated.View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  // The avatar is drawn at 36; the box around it is 44 and the negative margin
  // hands those 8 points back, so the header keeps its height and the avatar
  // does not shift off the right edge (PLA-40).
  avatarAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    margin: -(MIN_TOUCH_TARGET - 36) / 2,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    // Chip went from 37 to 44 to be tappable; give 4 of those 7 points back
    // here so the feed below only moves by 3 (PLA-40).
    paddingBottom: spacing.sm,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  errorContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
});
