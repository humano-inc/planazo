import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { FeedPollItem } from './feedPolls';
import { useVotePlanPoll } from './usePlanPoll';

export interface FeedPollTransition {
  optionId: string;
  phase: 'saving' | 'saved';
}

type ActivePollTransition = FeedPollTransition & { item: FeedPollItem };

const POLL_SUCCESS_HOLD_MS = 700;

/**
 * Owns the feed-only moment between choosing a poll option and removing its
 * card. The optimistic cache may hide the source item immediately, so this
 * hook holds a captured copy through saving, success and the short exit hold.
 * A failed write drops the capture after the mutation restores the cache.
 */
export function useFeedPollVoteTransition(
  pollItems: FeedPollItem[],
  userId: string | undefined,
  showPolls: boolean
) {
  const [transitions, setTransitions] = useState<Record<string, ActivePollTransition>>({});
  const [answeredPollIds, setAnsweredPollIds] = useState<Record<string, true>>({});
  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const activePollIds = useRef(new Set<string>());
  const mounted = useRef(true);
  const pollVote = useVotePlanPoll();

  useEffect(() => {
    const timers = exitTimers.current;
    const activeIds = activePollIds.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      activeIds.clear();
    };
  }, []);

  const visiblePolls = useMemo(() => {
    if (!showPolls) return [];

    const byId = new Map(
      pollItems.filter((poll) => !answeredPollIds[poll.id]).map((poll) => [poll.id, poll])
    );
    for (const transition of Object.values(transitions)) {
      byId.set(transition.item.id, transition.item);
    }
    return [...byId.values()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        a.id.localeCompare(b.id)
    );
  }, [answeredPollIds, pollItems, showPolls, transitions]);

  const sendPollVote = useCallback(
    (item: FeedPollItem, optionId: string) => {
      if (!userId || activePollIds.current.has(item.id)) return;

      activePollIds.current.add(item.id);
      setTransitions((prev) => ({
        ...prev,
        [item.id]: { item, optionId, phase: 'saving' },
      }));

      void pollVote
        .mutateAsync({
          planId: item.planId,
          pollId: item.id,
          userId,
          optionId,
        })
        .then(() => {
          if (!mounted.current) return;

          // The trigger-backed receipt is the durable source of truth. This
          // mark prevents a stale refetch from flashing the poll back during
          // the rest of the current feed session.
          setAnsweredPollIds((prev) => ({ ...prev, [item.id]: true }));
          setTransitions((prev) => {
            const current = prev[item.id];
            return current
              ? { ...prev, [item.id]: { ...current, phase: 'saved' } }
              : prev;
          });
          AccessibilityInfo.announceForAccessibility('Vote saved');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

          const timer = setTimeout(() => {
            if (!mounted.current) return;
            setTransitions((prev) => {
              const next = { ...prev };
              delete next[item.id];
              return next;
            });
            activePollIds.current.delete(item.id);
            exitTimers.current.delete(item.id);
          }, POLL_SUCCESS_HOLD_MS);
          exitTimers.current.set(item.id, timer);
        })
        .catch(() => {
          if (!mounted.current) return;
          activePollIds.current.delete(item.id);
          setTransitions((prev) => {
            const next = { ...prev };
            delete next[item.id];
            return next;
          });
        });
    },
    [pollVote, userId]
  );

  return { sendPollVote, transitions, visiblePolls };
}
