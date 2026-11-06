interface GroupWithCity {
  id: string;
  city_id?: string | null;
}

/**
 * Which city to search around: the plan's group, or for a plan with no group the
 * person's first one. Null leaves it to place-search's own default.
 */
export function placeSearchCity(
  groups: GroupWithCity[],
  groupId: string | null | undefined
): string | null {
  const group = groups.find((g) => g.id === groupId) ?? groups[0];
  return group?.city_id ?? null;
}
