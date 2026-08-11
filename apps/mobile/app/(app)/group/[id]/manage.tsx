import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../stores/authStore';
import { errorCopy, groupGoneCopy, isNotFoundError } from '../../../../lib/queryErrors';
import { usePendingRemoval } from '../../../../lib/usePendingRemoval';
import { groupManageQuery, invalidateGroup } from '../../../../lib/groupManageQuery';
import { adminCount, adminSummary, byArrival, memberName } from '../../../../lib/groupAdmins';
import { MIN_TOUCH_TARGET } from '../../../../lib/a11y';
import { useDismissTo } from '../../../../lib/navigation';
import {
  BLOCKED_QUERY_KEY,
  blockUser,
  fetchBlockedIds,
  unblockUser,
} from '../../../../lib/moderation';
import { canInvite } from '../../../../lib/groupDoor';
import { useDoorSettings, useJoinRequests } from '../../../../lib/useGroupDoor';
import { MemberList, type GroupMemberRow } from '../../../../components/group/MemberList';
import { GroupPrefsCard } from '../../../../components/group/GroupPrefsCard';
import { DoorSettings } from '../../../../components/group/DoorSettings';
import { JoinRequests } from '../../../../components/group/JoinRequests';
import {
  BackButton,
  ThemedText,
  ErrorState,
  ConfirmSheet,
  HeaderRow,
} from '../../../../components/ui';
import { colors, spacing } from '../../../../theme/tokens';

type PendingConfirm = { kind: 'remove' | 'block'; userId: string; name: string };

export default function ManageGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useDismissTo(`/(app)/group/${id}`);
  // The error state is reached when the group is gone or unreadable, so the
  // group route is exactly where not to send someone.
  const leaveGone = useDismissTo('/(app)/(tabs)/groups');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: group, isLoading, isError, error, refetch } = useQuery(groupManageQuery(id));

  const invalidate = () => invalidateGroup(queryClient, id);

  // Read off the query rather than the sorted rows further down, because the
  // hooks that need it run before the loading guard those rows sit behind.
  // One identification of "me", so the Invite button and the door dials can
  // never disagree about who is looking at them.
  const me = ((group?.group_members ?? []) as GroupMemberRow[]).find(
    (m) => m.user_id === user?.id
  );
  const isAdmin = me?.role === 'admin';

  const { requests, respond, answeringId } = useJoinRequests(String(id), isAdmin);
  const setDoor = useDoorSettings(String(id));

  // Who this user has shut out (the shield rule: those people no longer see
  // this user's plans). Only ever their own list — RLS on blocked_users makes
  // any other answer impossible.
  const { data: blockedIds } = useQuery({
    queryKey: BLOCKED_QUERY_KEY,
    queryFn: fetchBlockedIds,
    enabled: !!user,
  });

  const setBlocked = useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      if (!user) throw new Error('Not signed in');
      if (blocked) {
        await blockUser(user.id, userId);
      } else {
        await unblockUser(user.id, userId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BLOCKED_QUERY_KEY });
      // The block dissolves ties server-side (friendship, their place in this
      // user's upcoming plans), so anything derived from those refetches.
      queryClient.invalidateQueries({ queryKey: ['home-plans'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      invalidate();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  // The RPC, not a delete: removing somebody also withdraws the invites they
  // sent and resets the link, so the way back in goes with them (PLA-49).
  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_group_member', {
        p_group_id: id,
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-invite-sheet', id] });
      invalidate();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const setAnyoneCanPost = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.from('groups').update({ anyone_can_post: on }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const setNotify = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.rpc('set_group_notify', {
        p_group_id: id,
        p_notify: on,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const leaveGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('leave_group', { p_group_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['home-plans'] });
      router.navigate('/(app)/(tabs)/groups');
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  // Only one row is ever open.
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const { pendingRemovalId, startRemoval } = usePendingRemoval(removeMember.mutate);

  if (!isLoading && (isError || !group)) {
    const notFound = !id || isNotFoundError(error);
    const copy = notFound ? groupGoneCopy : errorCopy(error);

    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ErrorState
          title={copy.title}
          body={copy.body}
          onRetry={notFound ? undefined : () => refetch()}
          onBack={leaveGone}
          testID="group-manage-error"
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

  const members = [...(group.group_members as GroupMemberRow[])].sort(byArrival);
  // Dropping the pending one is what usePendingRemoval's id is for.
  const others = members.filter(
    (m) => m.user_id !== user?.id && m.user_id !== pendingRemovalId
  );
  const blocked = new Set(blockedIds ?? []);

  const askRemove = (m: GroupMemberRow) =>
    setConfirm({ kind: 'remove', userId: m.user_id, name: memberName(m) });

  const askBlock = (m: GroupMemberRow) => {
    // Unblocking is not destructive and undoes itself, so it does not ask.
    if (blocked.has(m.user_id)) {
      setBlocked.mutate({ userId: m.user_id, blocked: false });
      setOpenRowId(null);
      return;
    }
    setConfirm({ kind: 'block', userId: m.user_id, name: memberName(m) });
  };

  const runConfirm = () => {
    if (!confirm) return;
    setConfirm(null);
    setOpenRowId(null);
    if (confirm.kind === 'remove') {
      startRemoval(confirm.userId, confirm.name);
    } else {
      setBlocked.mutate({ userId: confirm.userId, blocked: true });
    }
  };

  const confirmCopy =
    confirm?.kind === 'remove'
      ? {
          title: `Remove ${confirm.name}?`,
          body: 'They drop out of this group’s plans too, and the invite link resets so the old one cannot let them back in.',
          action: 'Remove',
        }
      : {
          title: `Block ${confirm?.name}?`,
          body: 'Your plans stop showing up for them and you are no longer friends. They are not told, and they stay in the group unless an admin removes them. You still see their plans as usual.',
          action: 'Block',
        };

  const confirmLeave = () =>
    Alert.alert(`Leave ${group.name}?`, 'You’ll drop out of plans you said yes to.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leaveGroup.mutate() },
    ]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <HeaderRow
        left={
          <BackButton
            label={group.name}
            onPress={goBack}
            testID="back"
            style={styles.navBack}
          />
        }
        rightSpacerWidth={MIN_TOUCH_TARGET}
        title={isAdmin ? 'Manage' : 'Members'}
      />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <JoinRequests
          requests={requests}
          answeringId={answeringId}
          onRespond={(userId, approve) => respond.mutate({ userId, approve })}
        />

        <MemberList
          me={me}
          others={others}
          blocked={blocked}
          openRowId={openRowId}
          onOpenChange={setOpenRowId}
          onAskRemove={askRemove}
          onAskBlock={askBlock}
          onInvite={
            canInvite(group.who_can_invite, me?.role)
              ? () => router.push(`/(app)/group/${id}/invite`)
              : null
          }
        />

        <DoorSettings
          whoCanInvite={group.who_can_invite}
          joinMode={group.join_mode}
          onChange={(door) => setDoor.mutate(door)}
          pending={setDoor.isPending}
          isAdmin={isAdmin}
        />

        <GroupPrefsCard
          anyoneCanPost={!!group.anyone_can_post}
          onAnyoneCanPost={(on) => setAnyoneCanPost.mutate(on)}
          anyoneCanPostPending={setAnyoneCanPost.isPending}
          whoCanInvite={group.who_can_invite}
          notify={!!me?.notify_new_plans}
          onNotify={(on) => setNotify.mutate(on)}
          notifyPending={setNotify.isPending}
          isAdmin={isAdmin}
          adminSummary={adminSummary(adminCount(members))}
          onEditProfile={() => router.push(`/(app)/group/${id}/edit`)}
          onAdmins={() => router.push(`/(app)/group/${id}/admins`)}
        />

        <View style={styles.leaveBlock}>
          <Pressable
            style={({ pressed }) => [styles.reportRow, pressed && styles.rowPressed]}
            onPress={() =>
              router.push({
                pathname: '/(app)/report',
                params: { type: 'group', id: String(id), subject: group.name },
              })
            }
            accessibilityRole="button"
            testID="report-group"
          >
            <ThemedText variant="caption" color={colors.textSecondary}>
              Report this group
            </ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.leaveCard, pressed && styles.rowPressed]}
            onPress={confirmLeave}
            accessibilityRole="button"
            testID="leave-group"
          >
            <ThemedText variant="bodyStrong" color={colors.accentPressed}>
              Leave {group.name}
            </ThemedText>
          </Pressable>
          <ThemedText variant="caption" style={styles.leaveNote}>
            You’ll drop out of plans you said yes to. Someone else keeps admin.
          </ThemedText>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={!!confirm}
        title={confirmCopy.title}
        body={confirmCopy.body}
        actionLabel={confirmCopy.action}
        onConfirm={runConfirm}
        onCancel={() => {
          setConfirm(null);
          setOpenRowId(null);
        }}
        testID="member-confirm"
      />
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
  navBack: {
    maxWidth: '42%',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 6,
    paddingBottom: 40,
    gap: spacing.xxl,
  },
  rowPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  reportRow: {
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  leaveBlock: {
    gap: spacing.sm,
    paddingBottom: 10,
  },
  leaveCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: spacing.lg,
    alignItems: 'center',
  },
  leaveNote: {
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
