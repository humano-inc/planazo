import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GroupRole } from '@planazo/shared';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../stores/authStore';
import { alertActionError, groupGoneCopy, isLastAdminError } from '../../../../lib/queryErrors';
import { groupManageQuery, invalidateGroup } from '../../../../lib/groupManageQuery';
import { splitByRole, demoteConfirmCopy, memberName } from '../../../../lib/groupAdmins';
import { useDismissTo } from '../../../../lib/navigation';
import type { GroupMemberRow } from '../../../../components/group/MemberList';
import { AdminsCard } from '../../../../components/group/AdminsCard';
import { PromoteCard } from '../../../../components/group/PromoteCard';
import {
  BackButton,
  ThemedText,
  QueryScreen,
  ConfirmSheet,
  FormScreen,
  HeaderRow,
} from '../../../../components/ui';
import { spacing } from '../../../../theme/tokens';

/**
 * Who runs the group, and the one place a role changes ("Group Admins"
 * design doc, PLA-50).
 *
 * Two cards: the admins, each with a way out of the role behind a confirm
 * sheet, and everyone who could hold it, behind a search and a single tap.
 * Promotion is instant because it is reversible right here; demotion asks
 * first because it takes something away from a person. A non-admin who
 * deep-links in gets the admins card read-only: no demote controls, no
 * promote section, and RLS refuses the write regardless.
 */
export default function GroupAdminsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const goBack = useDismissTo(`/(app)/group/${id}`);
  // The error state is reached when the group is gone or unreadable, so the
  // group route is exactly where not to send someone.
  const leaveGone = useDismissTo('/(app)/(tabs)/groups');
  const { user } = useAuthStore();
  const [demoting, setDemoting] = useState<GroupMemberRow | null>(null);

  const { data: group, isLoading, isError, error, refetch } = useQuery(groupManageQuery(id));

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: GroupRole }) => {
      const { error } = await supabase
        .from('group_members')
        .update({ role })
        .eq('group_id', id)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => invalidateGroup(queryClient, id),
    // Refetching matters as much as the alert for this one failure: a refused
    // step-down means someone else stepped down first, so the list on screen is
    // already wrong and still offering the control (PLA-86). Only for this one,
    // though — a write that failed because the network did leaves the list
    // perfectly good, and a refetch that cannot succeed would replace it with a
    // full-screen error.
    onError: (error: unknown) => {
      if (isLastAdminError(error)) invalidateGroup(queryClient, id);
      alertActionError(error);
    },
  });

  // One spelling of "there is nothing to draw", so the guard and what
  // QueryScreen renders behind it can never disagree.
  const failed = isError || !group;
  if (isLoading || failed) {
    return (
      <QueryScreen
        isLoading={isLoading}
        failed={failed}
        id={id}
        error={error}
        goneCopy={groupGoneCopy}
        onRetry={() => refetch()}
        onBack={leaveGone}
        testID="group-admins-error"
      />
    );
  }

  const members = group.group_members as GroupMemberRow[];
  const { admins, candidates } = splitByRole(members, user?.id);
  const viewerIsAdmin = admins.some((m) => m.user_id === user?.id);

  const runDemote = () => {
    if (!demoting) return;
    setDemoting(null);
    setRole.mutate({ userId: demoting.user_id, role: 'member' });
  };

  const confirmCopy = demoteConfirmCopy(
    demoting ? memberName(demoting) : '',
    demoting?.user_id === user?.id
  );

  const navRow = (
    <HeaderRow
      left={<BackButton label="Manage" onPress={goBack} testID="back" />}
      rightSpacerWidth={48}
      title="Admins"
    />
  );

  return (
    // The ConfirmSheet is a sibling of the form, not content inside it: it
    // covers the screen when it opens and must not scroll with the list.
    <>
      <FormScreen header={navRow} contentContainerStyle={styles.content} testID="admins">
        <ThemedText variant="sub">
          Admins edit the group, remove people, and make other admins.
        </ThemedText>

        <AdminsCard
          admins={admins}
          myId={user?.id}
          createdBy={group.created_by ?? null}
          viewerIsAdmin={viewerIsAdmin}
          disabled={setRole.isPending}
          onDemote={setDemoting}
        />

        {viewerIsAdmin ? (
          <PromoteCard
            candidates={candidates}
            disabled={setRole.isPending}
            onPromote={(m) => setRole.mutate({ userId: m.user_id, role: 'admin' })}
          />
        ) : null}
      </FormScreen>

      <ConfirmSheet
        visible={!!demoting}
        title={confirmCopy.title}
        body={confirmCopy.body}
        actionLabel={confirmCopy.actionLabel}
        onConfirm={runDemote}
        onCancel={() => setDemoting(null)}
        testID="confirm-demote"
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 6,
    gap: spacing.xxl,
  },
});
