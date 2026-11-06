/**
 * Where tapping a push goes, from the `data` the fan-out put on it. Every push
 * about a plan names the plan. One about a comment also names the comment, and
 * the conversation is what the tap was for.
 *
 * Its own file rather than in `lib/push.ts`, which pulls the native notification
 * and device modules in at module scope and would take them into anything that
 * only wants to read a route.
 */
export function pushRoute(data: Record<string, unknown> | null | undefined) {
  const planId = data?.plan_id;
  if (typeof planId !== 'string') return null;
  return typeof data?.comment_id === 'string'
    ? (`/(app)/plan/${planId}/comments` as const)
    : (`/(app)/plan/${planId}` as const);
}
