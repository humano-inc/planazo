/**
 * Everything the Find people screen derives without touching the network:
 * who you already know, who is waiting on whom, and who the group you share
 * says you have planned with. The screen keeps the queries; this keeps the
 * shapes they come back in.
 */

/** A person as every list on Find people renders them. */
export interface PersonRow {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  /** "both in Piso Gràcia", or nothing when no group is shared. */
  note: string | null;
}

/** Where a person stands with you, which is what the row's pill says. */
export type Relation = 'friend' | 'requested' | 'incoming' | 'none';

/** The slice of a pending `friendships` row the split below reads. */
export interface PendingFriendshipRow {
  requester_id: string;
  addressee_id: string;
}

/** Pending requests, seen from your side of them. */
export interface PendingSides {
  outgoing: Set<string>;
  incoming: Set<string>;
}

/** The nested `group_members` select behind the suggestions list. */
export interface SharedGroupRow {
  groups: {
    name: string;
    group_members: Array<{
      profile: {
        id: string;
        display_name: string;
        handle: string | null;
        avatar_url: string | null;
      } | null;
    }>;
  } | null;
}

/** The three things that decide a relation, gathered where the screen holds them. */
export interface RelationSources {
  /** Accepted friendships, from `useFriends`. */
  friendIds: Set<string>;
  /** Requests fired from this screen, so Add flips in place without a refetch. */
  sentTo: Record<string, true>;
  /** What the server says is pending, absent until that query lands. */
  pending: PendingSides | undefined;
}

/**
 * One pending row is one arrow, and which end you are on decides which list
 * it belongs in. A row you requested is outgoing; anything else reached you.
 */
export function partitionPendingFriendships(
  rows: PendingFriendshipRow[],
  myId: string | undefined
): PendingSides {
  const outgoing = new Set<string>();
  const incoming = new Set<string>();
  rows.forEach((f) => {
    if (f.requester_id === myId) outgoing.add(f.addressee_id);
    else incoming.add(f.requester_id);
  });
  return { outgoing, incoming };
}

/**
 * Everyone you share a group with, once each, carrying the group that
 * introduced you. Someone in two of your groups keeps the name of whichever
 * group the query returned first: the note is a reason to recognise a face,
 * not a claim about which group matters more.
 */
export function sharedPeopleFrom(
  rows: SharedGroupRow[],
  myId: string | undefined
): PersonRow[] {
  const seen = new Map<string, PersonRow>();
  rows.forEach((row) => {
    (row.groups?.group_members ?? []).forEach((m) => {
      const p = m.profile;
      if (!p || p.id === myId || seen.has(p.id)) return;
      seen.set(p.id, {
        id: p.id,
        name: p.display_name,
        handle: p.handle,
        avatarUrl: p.avatar_url,
        note: `both in ${row.groups!.name}`,
      });
    });
  });
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The pill on a person's row, in precedence order. A friendship outranks
 * anything pending, and your own outgoing request outranks theirs, so a
 * crossing pair reads as Requested rather than flipping to Accept.
 */
export function relationOf(sources: RelationSources, id: string): Relation {
  const { friendIds, sentTo, pending } = sources;
  if (friendIds.has(id)) return 'friend';
  if (sentTo[id] || pending?.outgoing.has(id)) return 'requested';
  if (pending?.incoming.has(id)) return 'incoming';
  return 'none';
}

/**
 * What actually reaches `search_people`. The stripped characters are the ones
 * that mean something to the query the RPC builds, so a name typed with them
 * searches for the rest. Two letters of real text is the floor, which is why
 * the screen measures this and never the raw box: "a(" is one letter.
 */
export function cleanPeopleQuery(query: string): string {
  return query.trim().replace(/[%,()]/g, '');
}

/** The floor `cleanPeopleQuery`'s result has to clear before a search runs. */
export const MIN_SEARCH_LENGTH = 2;

/** A row of `search_people`, which returns profiles rather than PersonRows. */
export interface SearchResultRow {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
}

/**
 * Search results wearing the note the suggestions list would have given them.
 * Finding someone by name should not hide that you are already in a group
 * together.
 */
export function searchResultsWithNotes(
  rows: SearchResultRow[],
  sharedPeople: PersonRow[]
): PersonRow[] {
  const sharedNote = new Map(sharedPeople.map((p) => [p.id, p.note]));
  return rows.map((p) => ({
    id: p.id,
    name: p.display_name,
    handle: p.handle,
    avatarUrl: p.avatar_url,
    note: sharedNote.get(p.id) ?? null,
  }));
}
