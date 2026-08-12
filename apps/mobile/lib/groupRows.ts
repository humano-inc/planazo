import {
  flattenNestedOptions,
  needsUserResponse,
  type NestedDateOption,
  type PlanType,
  type RsvpLike,
} from '@planazo/shared';

/** The membership row the Groups tab's query selects, as this file reads it. */
export interface GroupMembership {
  group_id: string;
  role: string;
  groups: {
    name: string;
    color: string | null;
    image_url: string | null;
    created_at?: string | null;
  };
}

/** One open plan, sliced to what "waiting on you" reads. */
export interface GroupNeedsSource {
  group_id: string;
  plan_type: string;
  status?: string | null;
  rsvps?: RsvpLike[] | null;
  plan_date_options?: NestedDateOption[] | null;
}

export interface GroupRow {
  id: string;
  role: string;
  name: string;
  color: string | null;
  imageUrl: string | null;
  members: number;
  needsYou: number;
}

type DeriveInput = {
  memberships: GroupMembership[];
  /** One row per member per group — the tally behind the "N people" line. */
  memberRows: { group_id: string }[];
  plans: GroupNeedsSource[];
  /** Required: the only caller runs behind `enabled: !!user`. */
  userId: string;
};

/**
 * The rows the Groups tab renders: each membership joined to its member count
 * and to how many open plans still wait on this user, oldest group first.
 * Pure — useGroupRows feeds it what its fetches returned.
 */
export function deriveGroupRows({ memberships, memberRows, plans, userId }: DeriveInput): GroupRow[] {
  const memberCount: Record<string, number> = {};
  memberRows.forEach((c) => {
    memberCount[c.group_id] = (memberCount[c.group_id] ?? 0) + 1;
  });

  const needsCount: Record<string, number> = {};
  plans.forEach((plan) => {
    const { availabilities } = flattenNestedOptions(plan.plan_date_options);
    const needs = needsUserResponse(
      {
        plan_type: plan.plan_type as PlanType,
        status: plan.status,
        rsvps: plan.rsvps,
        availabilities,
      },
      userId
    );
    if (needs) needsCount[plan.group_id] = (needsCount[plan.group_id] ?? 0) + 1;
  });

  return memberships
    .map((m) => ({
      id: m.group_id,
      role: m.role,
      name: m.groups.name,
      color: m.groups.color,
      imageUrl: m.groups.image_url,
      createdAt: m.groups.created_at ?? '',
      members: memberCount[m.group_id] ?? 0,
      needsYou: needsCount[m.group_id] ?? 0,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
