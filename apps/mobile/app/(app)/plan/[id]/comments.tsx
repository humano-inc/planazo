import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { canCommentOnPlan } from '@planazo/shared';
import { CommentComposer } from '../../../../components/plan/CommentComposer';
import { CommentRow } from '../../../../components/plan/CommentRow';
import {
  BackButton,
  EmptyState,
  ErrorState,
  FormScreen,
  QueryScreen,
  ThemedText,
} from '../../../../components/ui';
import { openActionSheet } from '../../../../lib/actionSheet';
import { useDismissTo } from '../../../../lib/navigation';
import { commentAction, type PlanComment } from '../../../../lib/planComments';
import { errorCopy, planGoneCopy } from '../../../../lib/queryErrors';
import { usePlanComments } from '../../../../lib/usePlanComments';
import { planDetailQuery } from '../../../../lib/usePlanDetail';
import { useStickToNewest } from '../../../../lib/useStickToNewest';
import { useAuthStore } from '../../../../stores/authStore';
import { colors, spacing } from '../../../../theme/tokens';

/**
 * A push about another plan's comments swaps `id` under this route rather than
 * remounting it. The key is what stops a half-written comment following you there
 * and being sent to the wrong plan (the same trap as PLA-18).
 */
export default function PlanCommentsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlanCommentsScreen key={id} planId={String(id)} />;
}

/**
 * The whole conversation on a plan, oldest first and opened at the newest
 * (PLA-152). Anyone who can see the plan can write here, until it is called off.
 * Then it stays readable and the composer goes.
 */
function PlanCommentsScreen({ planId }: { planId: string }) {
  const router = useRouter();
  const leave = useDismissTo(`/(app)/plan/${planId}`);
  const { user } = useAuthStore();
  const [draft, setDraft] = useState('');

  const planQuery = useQuery(planDetailQuery(planId));
  const { comments, isError, error, send, remove } = usePlanComments(planId);
  const { scrollRef, scrollProps, follow } = useStickToNewest(!!comments);

  const plan = planQuery.data;
  if (planQuery.isLoading || planQuery.isError || !plan) {
    return (
      <QueryScreen
        isLoading={planQuery.isLoading}
        failed={planQuery.isError || !plan}
        id={planId}
        error={planQuery.error}
        goneCopy={planGoneCopy}
        onRetry={() => planQuery.refetch()}
        onBack={leave}
        testID="comments-error"
      />
    );
  }

  const open = canCommentOnPlan(plan);

  const submit = () => {
    follow();
    send.mutate(draft, { onSuccess: () => setDraft('') });
  };

  const report = (comment: PlanComment) =>
    router.push({
      pathname: '/(app)/report',
      params: {
        type: 'comment',
        id: comment.id,
        subject: `${comment.author.display_name}'s comment`,
        personId: comment.author_id,
        personName: comment.author.display_name,
      },
    });

  const actionFor = (comment: PlanComment) =>
    commentAction(comment.author_id, user?.id) === 'delete'
      ? { label: 'Delete comment', destructive: true, run: () => remove.mutate(comment.id) }
      : { label: 'Report comment', run: () => report(comment) };

  const openActions = (comment: PlanComment) => {
    Haptics.selectionAsync().catch(() => {});
    openActionSheet({ androidTitle: 'Comment', rows: [actionFor(comment)] });
  };

  return (
    <FormScreen
      header={
        <View style={styles.header}>
          <BackButton label="Back" onPress={leave} testID="comments-back" />
          <ThemedText variant="headerTitle">Comments</ThemedText>
          <ThemedText variant="sub" color={colors.textSecondary} numberOfLines={1}>
            {plan.title}
          </ThemedText>
          {open ? null : (
            <ThemedText variant="caption" color={colors.textMuted} testID="comments-closed">
              Called off, so this is closed to new comments.
            </ThemedText>
          )}
        </View>
      }
      footer={
        open ? (
          <CommentComposer
            value={draft}
            onChangeText={setDraft}
            onSend={submit}
            sending={send.isPending}
          />
        ) : undefined
      }
      scrollRef={scrollRef}
      scrollProps={scrollProps}
      inputInFooter
      contentContainerStyle={[styles.content, open && styles.aboveComposer]}
      testID="comments"
    >
      {isError && !comments ? <ErrorState {...errorCopy(error)} /> : null}

      {comments?.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={open ? "Ask what time, or say what you're bringing." : undefined}
          testID="comments-empty"
        />
      ) : null}

      {comments?.map((comment) => (
        <Pressable
          key={comment.id}
          onLongPress={() => openActions(comment)}
          // A long press is out of reach of a screen reader, so the same action
          // is offered the way it can find one.
          accessibilityActions={[{ name: 'act', label: actionFor(comment).label }]}
          onAccessibilityAction={() => openActions(comment)}
          style={({ pressed }) => pressed && styles.pressed}
          testID={`comment-${comment.id}`}
        >
          <CommentRow comment={comment} userId={user?.id} />
        </Pressable>
      ))}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.xxs,
  },
  content: {
    paddingTop: spacing.sm,
    gap: spacing.xl,
  },
  // Only with the composer there. Without a footer the content is what clears the
  // home indicator, and FormScreen owns that padding.
  aboveComposer: {
    paddingBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
});
