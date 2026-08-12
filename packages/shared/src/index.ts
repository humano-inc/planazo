import type { Tables } from './database.types';

/**
 * The profiles row, straight from the generated schema. It used to be a
 * hand-rolled interface that drifted from the database (it claimed
 * `created_at` was non-null; the column is nullable), so it is an alias now:
 * one shape, regenerated with the schema, impossible to disagree with it.
 */
export type Profile = Tables<'profiles'>;

/**
 * The domain unions behind the CHECK-constrained `text` columns. The generated
 * types can only see `string` there, so these stay hand-written, and a query
 * that feeds domain logic narrows to them at the boundary rather than letting
 * `string` leak inward. They are the only hand-rolled schema knowledge left in
 * this file, and each one is a constraint the database really enforces.
 */
export type GroupRole = 'admin' | 'member';
export type RsvpResponse = 'yes' | 'no' | 'pending';
export type PlanType = 'fixed' | 'flexible';
export type PlanStatus = 'open' | 'locked' | 'cancelled';

// Plan domain logic (single source of truth for confirmation math), by topic.
// Screens and DB functions must not reimplement these rules. Every consumer
// imports `@planazo/shared` rather than a module below, which is what leaves
// the topics free to move; nothing enforces that yet.
export * from './plan/types';
export * from './plan/dates';
export * from './plan/capacity';
export * from './plan/confirmation';
export * from './plan/album';
export * from './plan/polls';

/**
 * PLA-30 group photos. One folder per group, because that folder name is what
 * the storage policies in 20260803000001_group_images.sql cast to a UUID and
 * check admin membership against. It lives here so the app writes and the
 * integration suite asserts against the same string: a test that restates the
 * convention it is guarding cannot catch a change to it.
 */
export const GROUP_PHOTO_BUCKET = 'group-images';

export function groupPhotoPath(groupId: string): string {
  return `${groupId}/cover.jpg`;
}

// Generated from the Supabase schema — regenerate with `pnpm db:gen:types`
// after adding a migration. Do not edit by hand.
export type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from './database.types';
