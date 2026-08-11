import { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  flattenNestedOptions,
  goingLabel,
  isPlanConfirmed,
  isPlanPast,
  planGoingCount,
  planLastDate,
} from '@planazo/shared';
import { supabase } from '../../../../lib/supabase';
import { fmtDay, fmtTime } from '../../../../lib/dates';
import { inviteLinkFor } from '../../../../lib/shareLinks';
import { canInvite } from '../../../../lib/groupDoor';
import { useAuthStore } from '../../../../stores/authStore';
import { errorCopy, isNotFoundError } from '../../../../lib/queryErrors';
import { usePullToRefresh } from '../../../../lib/usePullToRefresh';
import { useDismissTo } from '../../../../lib/navigation';
import {
  ThemedText,
  Card,
  Button,
  AvatarStack,
  GroupTile,
  ErrorState,
  BackButton,
  HeaderAction,
  TextAction,
} from '../../../../components/ui';
import { PastPlansSection } from '../../../../components/group/PastPlansSection';
import { colors, spacing } from '../../../../theme/tokens';

export function shareInviteLink(groupName: string, inviteCode: string) {
  return Share.share({
    message: `Join ${groupName} on Planazo: ${inviteLinkFor(inviteCode)}`,
  }).catch(() => {});
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Deep links (push, QA) mount this as the first screen, so there is no
  // history to pop and the back label has to mean something anyway.
  const goBack = useDismissTo('/(app)/(tabs)/groups');
  const { user } = useAuthStore();

  const { data: group, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select(
          `id, name, description, color, image_url, who_can_invite,
          group_members(user_id, role, profile:profiles(id, display_name, avatar_url)),
          plans(id, title, plan_type, status, event_date, locked_date, min_people, created_at,
            cancelled_at, cancelled_by, cancel_reason,
            canceller:profiles!plans_cancelled_by_fkey(display_name),
            rsvps(user_id, response, profile:profiles(display_name)),
            plan_date_options(id, date, date_availability(user_id)))`
        )
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  const members = group?.group_members ?? [];
  const myRole = members.find((m: any) => m.user_id === user?.id)?.role;
  const memberNames = members.map((m: any) => m.profile?.display_name ?? '?');

  const planRows = useMemo(() => {
    return (group?.plans ?? []).map((p: any) => {
      // The row already carries plan_type, status, min_people and rsvps; the
      // options only need flattening out of their nested select shape.
      const { dateOptions, availabilities } = flattenNestedOptions(p.plan_date_options);
      const planData = { ...p, dateOptions, availabilities };

      // Yes-RSVPs once fixed or locked, the best single date while a flexible
      // plan is open — the same number plan detail renders, never the union of
      // everyone free on any date (that union is the faces row's business).
      const going = planGoingCount(planData);

      const optionCount = dateOptions.length;
      const when = p.locked_date
        ? `${fmtDay(p.locked_date)} · ${fmtTime(p.locked_date)}`
        : p.event_date
          ? `${fmtDay(p.event_date)} · ${fmtTime(p.event_date)}`
          : `${optionCount} date${optionCount === 1 ? '' : 's'} on the table`;

      const meta = goingLabel(going, p.min_people);

      // 19d: three endings, one Past section. A plan that happened keeps its
      // white card and the faces of who was there; the two non-events sink
      // into flat stone with one line of explanation.
      const optionDates = dateOptions.map((o) => o.date);
      const cancelled = p.status === 'cancelled';
      const past = cancelled || isPlanPast(p, optionDates);
      let ending: 'cancelled' | 'expired' | 'happened' | null = null;
      let endingLine = '';
      if (cancelled) {
        ending = 'cancelled';
        const who =
          p.cancelled_by === user?.id ? 'you' : p.canceller?.display_name ?? 'the host';
        endingLine = `Called off by ${who}`;
      } else if (past) {
        const happened = isPlanConfirmed(planData);
        ending = happened ? 'happened' : 'expired';
        if (!happened) endingLine = `Didn't happen · ${going} of ${p.min_people}`;
      }

      const wentNames = (p.rsvps ?? [])
        .filter((r: any) => r.response === 'yes')
        .map((r: any) =>
          r.user_id === user?.id ? 'You' : r.profile?.display_name ?? '?'
        )
        .sort((a: string, b: string) => (a === 'You' ? -1 : b === 'You' ? 1 : 0));
      const youWent = wentNames[0] === 'You';
      const wentLabel = youWent
        ? wentNames.length === 1
          ? 'You went'
          : `You and ${wentNames.length - 1} other${wentNames.length === 2 ? '' : 's'} went`
        : `${wentNames.length || going} went`;

      const endDate = planLastDate(p, optionDates);

      return {
        id: p.id,
        title: p.title,
        when,
        meta,
        open: p.status === 'open',
        past,
        ending,
        endingLine,
        wentNames,
        wentLabel,
        endDate,
        sortKey: endDate ? new Date(endDate).getTime() : 0,
      };
    });
  }, [group?.plans, user?.id]);

  const live = planRows.filter((p: any) => !p.past);
  const waiting = live.filter((p: any) => p.open);
  const locked = live.filter((p: any) => !p.open);
  const pastRows = planRows
    .filter((p: any) => p.past)
    .sort((a: any, b: any) => b.sortKey - a.sortKey);

  if (!isLoading && (isError || !group)) {
    const notFound = !id || isNotFoundError(error);
    const copy = notFound
      ? {
          title: "This group isn't here",
          body: "It was deleted, or you're not a member. Ask someone in it for an invite link.",
        }
      : errorCopy(error);

    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ErrorState
          title={copy.title}
          body={copy.body}
          onRetry={notFound ? undefined : () => refetch()}
          onBack={goBack}
          testID="group-error"
        />
      </SafeAreaView>
    );
  }

  if (isLoading || !group) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const renderPlanRow = (p: any, tone: 'waiting' | 'locked') => (
    <Card key={p.id}>
      <Pressable onPress={() => router.push(`/(app)/plan/${p.id}`)} testID={`plan-row-${p.id}`}>
        <ThemedText variant="cardTitle" style={styles.planTitle} numberOfLines={1}>
          {p.title}
        </ThemedText>
        <ThemedText variant="sub">{p.when}</ThemedText>
        <ThemedText
          variant="caption"
          color={tone === 'waiting' ? colors.accentPressed : colors.textMuted}
          style={styles.planMeta}
        >
          {p.meta}
        </ThemedText>
      </Pressable>
    </Card>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.navRow}>
        <BackButton
          label="Groups"
          onPress={goBack}
          testID="back"
        />
        {/* Same route either way. A member is not managing anything behind
            this word, so it does not say they are (PLA-61). */}
        <HeaderAction
          label={myRole === 'admin' ? 'Manage' : 'Members'}
          onPress={() => router.push(`/(app)/group/${id}/manage`)}
          align="end"
          tone="muted"
          testID="manage"
        />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerBlock}>
          <View style={styles.identityRow}>
            <GroupTile
              name={group.name}
              color={group.color}
              imageUrl={group.image_url}
              size={52}
            />
            <View style={styles.identityText}>
              <ThemedText variant="headerTitle">{group.name}</ThemedText>
              <ThemedText variant="caption">
                {myRole === 'admin' ? 'You run this group' : 'You’re a member here'}
              </ThemedText>
            </View>
          </View>

          {group.description ? (
            <ThemedText variant="body" color={colors.textSecondary}>
              {group.description}
            </ThemedText>
          ) : null}

          <View style={styles.facesRow}>
            <AvatarStack
              names={memberNames}
              label={`${members.length} ${members.length === 1 ? 'person' : 'people'}`}
            />
            {canInvite(group.who_can_invite, myRole) ? (
              <TextAction
                label="Invite"
                onPress={() => router.push(`/(app)/group/${id}/invite`)}
                align="end"
                testID="invite"
              />
            ) : null}
          </View>
        </View>

        {live.length === 0 ? (
          <View style={styles.emptyCard}>
            <ThemedText variant="body" color={colors.textSecondary} style={styles.emptyText}>
              Nothing on yet. Start something and it posts straight to {group.name}.
            </ThemedText>
            <Button
              label="Start a plan"
              size="md"
              onPress={() => router.push(`/(app)/plan/create?groupId=${id}`)}
              style={styles.emptyCta}
              testID="start-plan"
            />
          </View>
        ) : (
          <>
            {waiting.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  <ThemedText variant="sectionLabel" color={colors.accent}>
                    Waiting on answers · {waiting.length}
                  </ThemedText>
                </View>
                {waiting.map((p: any) => renderPlanRow(p, 'waiting'))}
              </View>
            ) : null}

            {locked.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.dot, { backgroundColor: colors.confirmed }]} />
                  <ThemedText variant="sectionLabel" color={colors.confirmed}>
                    Locked in · {locked.length}
                  </ThemedText>
                </View>
                {locked.map((p: any) => renderPlanRow(p, 'locked'))}
              </View>
            ) : null}
          </>
        )}

        <PastPlansSection rows={pastRows} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 6,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  headerBlock: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identityText: {
    flex: 1,
    gap: spacing.xxs,
  },
  facesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
  },
  emptyCta: {
    paddingHorizontal: spacing.xxl,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planTitle: {
    marginBottom: spacing.xxs,
  },
  planMeta: {
    marginTop: spacing.xs,
  },
});
