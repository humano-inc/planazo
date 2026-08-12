import { useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, RefreshControl, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { GroupRole, PlanType } from '@planazo/shared';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../../lib/supabase';
import { deriveGroupPlanRows, type GroupPlanRow } from '../../../../lib/groupPlanRows';
import { inviteLinkFor } from '../../../../lib/shareLinks';
import { canInvite } from '../../../../lib/groupDoor';
import { useAuthStore } from '../../../../stores/authStore';
import { usePullToRefresh } from '../../../../lib/usePullToRefresh';
import { useDismissTo } from '../../../../lib/navigation';
import {
  ThemedText,
  Card,
  Button,
  AvatarStack,
  GroupTile,
  QueryScreen,
  BackButton,
  HeaderAction,
  HeaderRow,
  TextAction,
} from '../../../../components/ui';
import { PastPlansSection } from '../../../../components/group/PastPlansSection';
import { colors, spacing } from '../../../../theme/tokens';

/**
 * Not `groupGoneCopy`: a deep link can land a stranger here without ever
 * having been in the group, so this one cannot say they were removed.
 */
const goneCopy = {
  title: "This group isn't here",
  body: "It was deleted, or you're not a member. Ask someone in it for an invite link.",
};

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
      if (!id) throw new Error('the group screen needs a group id');
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
      return data;
    },
    enabled: !!id,
  });
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  const members = group?.group_members ?? [];
  // `role` and `plan_type` are CHECK-constrained text columns, so the typed
  // client can only call them `string`. Narrowing them here keeps the domain
  // unions intact for canInvite() and the plan rows.
  const myRole = members.find((m) => m.user_id === user?.id)?.role as GroupRole | undefined;
  const memberNames = members.map((m) => m.profile.display_name);

  const { live, waiting, locked, past: pastRows } = useMemo(
    () =>
      deriveGroupPlanRows({
        plans: group?.plans.map((p) => ({ ...p, plan_type: p.plan_type as PlanType })),
        userId: user?.id,
      }),
    [group?.plans, user?.id]
  );

  if (isLoading || isError || !group) {
    return (
      <QueryScreen
        isLoading={isLoading}
        failed={isError || !group}
        id={id}
        error={error}
        goneCopy={goneCopy}
        onRetry={() => refetch()}
        onBack={goBack}
        testID="group-error"
      />
    );
  }

  const renderPlanRow = (p: GroupPlanRow, tone: 'waiting' | 'locked') => (
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
      <HeaderRow
        left={<BackButton label="Groups" onPress={goBack} testID="back" />}
        right={
          /* Same route either way. A member is not managing anything behind
             this word, so it does not say they are (PLA-61). */
          <HeaderAction
            label={myRole === 'admin' ? 'Manage' : 'Members'}
            onPress={() => router.push(`/(app)/group/${id}/manage`)}
            align="end"
            tone="muted"
            testID="manage"
          />
        }
      />

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
                {waiting.map((p) => renderPlanRow(p, 'waiting'))}
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
                {locked.map((p) => renderPlanRow(p, 'locked'))}
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
