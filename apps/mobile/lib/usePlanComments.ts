import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { requireUserId } from './currentUser';
import { contentViolation } from './moderation';
import {
  COMMENT_CARD_LATEST,
  commentsCardFrom,
  type CommentsCard,
  type PlanComment,
} from './planComments';
import { alertActionError, isForbiddenError, UserFacingError } from './queryErrors';
import { keyFactory } from './queryKey';
import { useAuthStore } from '../stores/authStore';

/**
 * A plan's comments, or with no id the prefix covering every plan's. Everything
 * keyed here starts with this, which is the invalidation contract: realtime and
 * the two mutations below invalidate it, and the list and the card both follow.
 */
export const planCommentsKey = keyFactory('plan-comments');

const COMMENT_SELECT =
  'id, plan_id, author_id, body, created_at, author:profiles!plan_comments_author_id_fkey(display_name, avatar_url)';

/**
 * What the plan-detail card shows, and nothing more: the newest few and how many
 * there are. The count is `exact` over rows RLS let through, so it is what this
 * viewer can read. A real total would announce a block.
 */
export function usePlanCommentsCard(planId: string) {
  const query = useQuery({
    queryKey: [...planCommentsKey(planId), 'card'],
    queryFn: async (): Promise<CommentsCard> => {
      const { data, error, count } = await supabase
        .from('plan_comments')
        .select(COMMENT_SELECT, { count: 'exact' })
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(COMMENT_CARD_LATEST);
      if (error) throw error;
      return commentsCardFrom(data, count);
    },
  });

  return { ...query, card: query.data };
}

/** The comments screen: the whole list, oldest first, and the two writes on it. */
export function usePlanComments(planId: string) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: planCommentsKey(planId),
    queryFn: async (): Promise<PlanComment[]> => {
      const { data, error } = await supabase
        .from('plan_comments')
        .select(COMMENT_SELECT)
        .eq('plan_id', planId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: planCommentsKey(planId) });

  const send = useMutation({
    mutationFn: async (draft: string) => {
      const body = draft.trim();
      const violation = contentViolation({ comment: body });
      if (violation) throw new UserFacingError(violation);

      const { error } = await supabase
        .from('plan_comments')
        .insert({ plan_id: planId, author_id: requireUserId(user?.id), body });
      // The composer only shows on a plan you can comment on, so a refusal means
      // that changed under you. Being told you are not in the group would be
      // the wrong story when the host has just called it off.
      if (isForbiddenError(error)) {
        throw new UserFacingError("This plan isn't taking comments any more.");
      }
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: alertActionError,
  });

  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('plan_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: alertActionError,
  });

  return { ...query, comments: query.data, send, remove };
}
