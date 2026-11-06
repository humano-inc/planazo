// The mobile app's cache-sync channel (PLA-28) only receives events for tables
// in the supabase_realtime publication. Nothing else in the stack notices when
// a table is missing from it — subscriptions just go silent — so the
// publication's contents are pinned here.
import { describe, it, expect, afterAll } from 'vitest';
import { Client } from 'pg';
import { resolveStack } from './env';
import { TestBed, TestUser, ok, daysFromNow } from './testbed';

describe('supabase_realtime publication', () => {
  it('publishes every table the cache-sync channel listens to', async () => {
    // Mirrors apps/mobile/lib/realtime.ts SUBSCRIBED_TABLES.
    const expected = ['rsvps', 'date_availability', 'plans', 'group_members', 'plan_comments'];

    const client = new Client({
      connectionString: resolveStack().dbUrl!,
      connectionTimeoutMillis: 10_000,
    });
    await client.connect();
    try {
      const res = await client.query(
        `select tablename from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public'`,
      );
      const published = res.rows.map((r: { tablename: string }) => r.tablename);
      for (const table of expected) {
        expect(published).toContain(table);
      }
    } finally {
      await client.end().catch(() => {});
    }
  });
});

// A live round trip, because this is the one thing about delivery that is ours
// and not Supabase's: whether a subscriber's SELECT policy holds on the socket.
// A block has to reach the wire, or a comment would announce what the list hides.
describe('a comment over the socket (PLA-152)', () => {
  const bed = new TestBed();
  const REALTIME_TIMEOUT_MS = 20_000;

  afterAll(() => bed.dispose());

  /**
   * Bodies a viewer receives for one plan, once the server says it is listening.
   * `SUBSCRIBED` alone is too early: postgres_changes reports ready separately, on
   * the system event, and a write before then is simply never delivered.
   */
  async function listen(viewer: TestUser, planId: string) {
    const bodies: string[] = [];
    const channel = viewer.client.channel(`comments-${viewer.id}`);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`realtime never became ready for ${viewer.name}`)),
        REALTIME_TIMEOUT_MS,
      );
      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'plan_comments',
            filter: `plan_id=eq.${planId}`,
          },
          (payload) => bodies.push((payload.new as { body: string }).body),
        )
        .on('system', {}, (payload: { extension?: string; status?: string }) => {
          if (payload.extension === 'postgres_changes' && payload.status === 'ok') {
            clearTimeout(timer);
            resolve();
          }
        })
        .subscribe((status, error) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timer);
            reject(error ?? new Error(`realtime reported ${status} for ${viewer.name}`));
          }
        });
    });

    return bodies;
  }

  async function until(condition: () => boolean, what: string) {
    const deadline = Date.now() + REALTIME_TIMEOUT_MS;
    while (!condition()) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  it('reaches a member and not someone its author blocked', { timeout: 60_000 }, async () => {
    const [host, author, member, blocked] = await Promise.all([
      bed.createUser('Socket Host'),
      bed.createUser('Socket Author'),
      bed.createUser('Socket Member'),
      bed.createUser('Socket Blocked'),
    ]);
    const group = await bed.createGroup(host);
    await Promise.all([author, member, blocked].map((user) => bed.join(group.id, user)));
    const planId = ok(
      await host.client
        .from('plans')
        .insert({
          group_id: group.id,
          created_by: host.id,
          title: 'it-comments-socket',
          plan_type: 'fixed',
          event_date: daysFromNow(7),
          min_people: 2,
        })
        .select('id')
        .single(),
    ).id;
    ok(
      await author.client
        .from('blocked_users')
        .insert({ blocker_id: author.id, blocked_id: blocked.id }),
    );

    try {
      const [memberHeard, blockedHeard] = await Promise.all([
        listen(member, planId),
        listen(blocked, planId),
      ]);

      ok(
        await author.client
          .from('plan_comments')
          .insert({ plan_id: planId, author_id: author.id, body: 'from the blocker' }),
      );
      // The WAL is delivered in order, so once the blocked person has this one,
      // the comment before it has had its chance to reach them and did not.
      ok(
        await host.client
          .from('plan_comments')
          .insert({ plan_id: planId, author_id: host.id, body: 'from the host' }),
      );

      await until(
        () => memberHeard.includes('from the host') && blockedHeard.includes('from the host'),
        "the host's comment to reach both subscribers",
      );

      expect(memberHeard).toEqual(['from the blocker', 'from the host']);
      expect(blockedHeard).toEqual(['from the host']);
    } finally {
      await Promise.all([member.client, blocked.client].map((c) => c.removeAllChannels()));
      await bed.service.from('plans').delete().eq('id', planId);
    }
  });
});
