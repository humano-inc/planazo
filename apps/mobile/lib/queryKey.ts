/**
 * How a query key that more than one file reaches for gets built.
 *
 * Two rules ride in here so that thirteen call sites do not each restate them:
 *
 * The **root is spelled once**. A hand-written `(id) => id ? ['plan-rsvps', id]
 * : ['plan-rsvp']` typechecks, and the typo is silent — the write lands, the
 * screen keeps showing what it showed, nothing fails. That is the failure this
 * whole sweep exists to remove, and a factory that spells its root twice
 * reintroduces it in miniature.
 *
 * The **bare form is a prefix of the keyed form**, structurally rather than by
 * agreement. react-query matches an invalidation filter positionally from the
 * front, so `feedKey()` only reaches `feedKey(userId)` while it stays a prefix
 * of it.
 *
 * A key whose id is a *pair* cannot use this: omitting one argument would
 * leave a hole in the middle, and a filter with a hole matches nothing. Those
 * spell themselves out, and say so.
 *
 * This file names no keys. The factories live beside the hooks that own the
 * queries, which is what stops the app growing a central registry that every
 * hook has to import and nobody can read.
 */
export function keyFactory<const Root extends string>(root: Root) {
  return (id?: string) => (id === undefined ? ([root] as const) : ([root, id] as const));
}
