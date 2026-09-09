import { useGoToGroups } from '../../lib/navigation';
import { EmptyState } from '../ui';

/**
 * Said in one place so the feed, the sheet and the create screen cannot drift
 * apart. Only the last line moves: "your plans land here" is true on the feed
 * and wrong anywhere a plan is being composed.
 */
export const NEEDS_GROUP_COPY = {
  title: 'Plans need people first',
  feedBody:
    'A plan goes to your friends or to a group. Add a friend or start a group, and your plans land here.',
  planBody:
    'A plan goes to your friends or to a group. Add a friend or start a group, then come back and post this.',
  cta: 'Sort out a group',
} as const;

/**
 * What a user with nobody to post to is told, wherever they meet it (PLA-68).
 * Since PLA-140 a plan can go to your friends, so "nobody" means no groups
 * and no friends; `needsPeople` in lib/planAudience.ts is the one predicate.
 *
 * The feed and the create sheet both reach this state, and before this they
 * said different things about it: the feed told you to start a plan, and the
 * sheet said nothing at all and disabled its own button. One component so
 * there is one story, and one destination — the Groups tab, which already
 * offers both doors, invite link first.
 */
export function NeedsGroupState({
  body = NEEDS_GROUP_COPY.feedBody,
  dismissFirst = false,
  testID,
}: {
  body?: string;
  /** Set on a modal: the sheet has to be gone before the tab underneath changes. */
  dismissFirst?: boolean;
  testID?: string;
}) {
  const goToGroups = useGoToGroups(dismissFirst);

  return (
    <EmptyState
      title={NEEDS_GROUP_COPY.title}
      body={body}
      ctaLabel={NEEDS_GROUP_COPY.cta}
      onPress={goToGroups}
      testID={testID}
    />
  );
}
