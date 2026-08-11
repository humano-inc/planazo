/**
 * The signed-in user's id, for the writes that cannot name an owner without
 * one.
 *
 * Every caller sits behind the auth gate, so in practice the id is always
 * there. It is a guard rather than a `!` because the typed Supabase client
 * made a real hole visible: `user_id: user?.id` on an upsert used to compile,
 * and an undefined id reached PostgREST as a missing column instead of failing
 * here. Throwing routes it into the same alert every other failed write uses.
 */
export function requireUserId(id: string | undefined | null): string {
  if (!id) throw new Error('Signed-out write attempted: no user id to write with.');
  return id;
}
