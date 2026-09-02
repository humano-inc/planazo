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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeed } from '../../../lib/useFeed';
import { deriveFeedItems } from '../../../lib/feedDerived';
import { useFeedAnswers } from '../../../lib/useFeedAnswers';
import { useCancelNotices } from '../../../lib/useCancelNotices';
import { useMyGroups } from '../../../lib/useMyGroups';
import { useFriends } from '../../../lib/useFriends';
import { audienceLabel, needsPeople } from '../../../lib/planAudience';
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

/** The poll card's context slot, in the field names lib/feedPolls.ts reads. */
const pollContext = (context: ReturnType<typeof audienceLabel>) => ({
  contextLabel: context.label,
  contextColor: context.color,
  contextPeople: context.people,
});

export default function FeedScreen() {
  const { profile, user } = useAuthStore();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  // Local date selections per flexible plan, committed on "Send N dates"
  const [pickedDates, setPickedDates] = useState<Record<string, string[]>>({});
  const reducedMotion = useReducedMotion();

  const { data: plans, isLoading, isError, error, refetch } = useFeed();
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  // An empty feed means two different things, and the plans query cannot tell
  // them apart: nothing posted yet, or nobody to post to. Only the second is
  // the user's problem to solve (PLA-68), and since PLA-140 it takes both no
  // groups and no friends to be there.
  const { hasGroups, loading: groupsLoading } = useMyGroups();
  const { friends, isPending: friendsLoading } = useFriends();
  const needsAnyone = needsPeople(hasGroups, friends.length > 0);

  const { notices, dismiss } = useCancelNotices();

  const answers = useFeedAnswers({
    onDatesSent: (planId) => setPickedDates((prev) => ({ ...prev, [planId]: [] })),
  });

  const decorated = useMemo(() => deriveFeedItems(plans, user?.id), [plans, user?.id]);

  const pollItems = useMemo(
    () =>
      deriveFeedPollItems(
        decorated.map((item) => ({
          planId: item.plan.id,
          planTitle: item.plan.title,
          ...pollContext(audienceLabel(item.plan)),
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
          <Avatar name={profile?.display_name ?? '?'} dark size={42} imageUrl={profile?.avatar_url} />
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
      {isLoading || groupsLoading || friendsLoading ? (
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

          {!hasVisibleItems && needsAnyone ? (
            // Sending this user to the create sheet was the loop PLA-68 is
            // about: the one action offered was the one thing they could not
            // do. A filter they cannot have set yet is not worth a branch —
            // with nobody to post to there are no plans to filter.
            <NeedsGroupState testID="feed-needs-group" />
          ) : !hasVisibleItems ? (
            <EmptyState
              title={filter === 'needs' ? 'Nothing to answer' : 'Nothing on the table'}
              body={
                filter === 'needs'
                  ? 'When someone proposes a plan to you, it lands here.'
                  : "Start something. Pick who it's for, throw out a date or a few, and see who bites."
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  avatarAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
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
