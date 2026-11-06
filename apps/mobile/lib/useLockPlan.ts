import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { alertActionError, UserFacingError } from './queryErrors';
import { invalidatePlanCaches } from './usePlanDetail';

export interface LockPlanInput {
  dateOptionId: string;
  startsAt: string;
  /** Null when the host gave no end. */
  endsAt: string | null;
}

/**
 * Ending a vote: the winning date, the start the host gave it, and the end if
 * they gave one.
 *
 * `lock_plan` answers a date that fell below the minimum with `locked: false`
 * rather than an error. Someone can withdraw while the sheet is open, and the
 * sheet closing as though it had worked would leave the vote running unnoticed.
 */
export function useLockPlan(
  planId: string,
  groupId: string | null | undefined,
  { onLocked }: { onLocked: () => void }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dateOptionId, startsAt, endsAt }: LockPlanInput) => {
      const { data, error } = await supabase.rpc('lock_plan', {
        p_plan_id: planId,
        p_date_option_id: dateOptionId,
        p_starts_at: startsAt,
        // Omitted rather than null, so lock_plan's `DEFAULT NULL` supplies it.
        p_ends_at: endsAt ?? undefined,
      });
      if (error) throw error;
      if ((data as { locked?: boolean } | null)?.locked === false) {
        throw new UserFacingError("That date doesn't have enough people any more.");
      }
    },
    onSuccess: () => {
      invalidatePlanCaches(queryClient, planId, groupId);
      onLocked();
    },
    onError: alertActionError,
  });
}
