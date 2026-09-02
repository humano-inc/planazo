import type { PlanAudience } from '@planazo/shared';
import { colors } from '../theme/tokens';

/**
 * Everything the screens say about who a plan is for (PLA-140).
 *
 * A plan is for its group, for all the creator's friends, or for friends of
 * friends. Three screens describe that: the create sheet's chips and footer,
 * the feed card's context slot, and the detail screen's chip row and reach
 * caption. The words live here, as pure functions of the row, so the tests
 * pin them without rendering anything.
 */

/** The audiences a plan can have besides its group, in the order the chips show. */
export const FRIEND_AUDIENCES: readonly PlanAudience[] = ['friends', 'friends_of_friends'];

export function isPlanAudience(value: string | null | undefined): value is PlanAudience {
  return value === 'group' || value === 'friends' || value === 'friends_of_friends';
}

/** What a chip on the create sheet is called. */
export function audienceChipLabel(audience: PlanAudience): string {
  return audience === 'friends' ? 'Friends' : 'Friends of friends';
}

/** The plan fields that decide what the context slot says. */
export interface AudienceSource {
  audience: PlanAudience;
  groups: { name: string; color: string | null } | null;
  /** The mutual friend you reach a friends-of-friends plan through, when you need one. */
  plan_bridge?: string | null;
}

export interface AudienceLabel {
  label: string;
  /**
   * Null on a group with no colour of its own: the card derives one from the
   * name, and that derivation lives beside the avatar, not here.
   */
  color: string | null;
  /** True when the slot draws the people mark rather than a group swatch. */
  people: boolean;
}

/** What a feed card or the detail chip row shows in its context slot. */
export function audienceLabel(plan: AudienceSource): AudienceLabel {
  if (plan.audience === 'group' && plan.groups) {
    return { label: plan.groups.name, color: plan.groups.color, people: false };
  }
  if (plan.audience === 'friends_of_friends') {
    const via = plan.plan_bridge ? ` · via ${plan.plan_bridge}` : '';
    return { label: `Friends of friends${via}`, color: colors.accent, people: true };
  }
  return { label: 'Your friends', color: colors.accent, people: true };
}

/** The create sheet's footer button. */
export function postLabel(audience: PlanAudience, groupName: string | null): string {
  if (audience === 'friends') return 'Post to your friends';
  if (audience === 'friends_of_friends') return 'Post to friends of friends';
  // Naming the group is the point of this label, so it waits until there is
  // a name: "Post to …" used to flash for everyone while the groups query
  // resolved (PLA-68).
  return groupName ? `Post to ${groupName}` : 'Post';
}

/** The one-line join rule under the chips. Groups need none: you see the members. */
export function audienceHelper(audience: PlanAudience): string | null {
  if (audience === 'friends') return "Everyone you're friends with sees it and can join.";
  if (audience === 'friends_of_friends') {
    return 'Your friends and their friends see it and can join.';
  }
  return null;
}

export interface ReachSource {
  audience: PlanAudience;
  hostName: string | null | undefined;
  bridge: string | null | undefined;
  youCreated: boolean;
}

/**
 * The caption under the answer bar that explains why you are looking at a
 * plan with no group. Null for a group plan: the group is the explanation.
 */
export function reachCaption({ audience, hostName, bridge, youCreated }: ReachSource): string | null {
  if (audience === 'group') return null;
  const host = hostName?.trim() || 'The host';
  if (audience === 'friends') {
    return youCreated
      ? 'You share this with all your friends.'
      : `${host} shares this with all their friends.`;
  }
  if (youCreated) return 'You share this with friends of friends.';
  const reach = `${host} shares plans with friends of friends.`;
  return bridge ? `${reach} You're here through ${bridge}.` : reach;
}

/**
 * Whether there is anyone at all to post to. A plan goes to a group or to
 * your friends, so the dead end (PLA-68) is now the person with neither.
 */
export function needsPeople(hasGroups: boolean, hasFriends: boolean): boolean {
  return !hasGroups && !hasFriends;
}
