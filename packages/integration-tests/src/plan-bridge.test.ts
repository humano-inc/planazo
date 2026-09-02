// PLA-140: a friends-of-friends plan tells the second hop which friend they
// share with the host ("via Marta"). `plan_bridge(plans)` is a computed column
// the client selects alongside the row, so this is where its answer, and its
// silence, get checked against the real graph.
//
//   host - amiga                       a direct friend: no bridge to name
//   host - ana  - segundo              segundo is two hops, via ana
//   host - zoe  - segundo              ...and via zoe (a second bridge)
//          zoe  - tercero              tercero is two hops, via zoe alone
//
// ana sorts before zoe, so she is the bridge segundo is told about until she
// blocks him; then it is zoe.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TestBed, TestUser, ok, daysFromNow } from './testbed';

const bed = new TestBed();

let host: TestUser;
let amiga: TestUser;
let ana: TestUser;
let zoe: TestUser;
let segundo: TestUser;
let tercero: TestUser;

const planIds: string[] = [];

async function befriend(a: TestUser, b: TestUser) {
  ok(await a.client.rpc('send_friend_request', { p_addressee: b.id }));
  const res = ok(await b.client.rpc('send_friend_request', { p_addressee: a.id })) as {
    status: string;
  };
  if (res.status !== 'accepted') {
    throw new Error(`befriend(${a.name}, ${b.name}) ended in ${res.status}`);
  }
}

async function createPlan(
  audience: 'friends' | 'friends_of_friends' | 'group',
  groupId: string | null = null,
) {
  const id = ok(
    await host.client
      .from('plans')
      .insert({
        audience,
        group_id: groupId,
        created_by: host.id,
        title: `bridge-${audience}-${randomUUID().slice(0, 8)}`,
        plan_type: 'fixed',
        event_date: daysFromNow(7),
        min_people: 1,
      })
      .select('id')
      .single(),
  ).id;
  planIds.push(id);
  return id;
}

/** The bridge as the client reads it: one select, the computed column by name. */
const bridgeFor = async (user: TestUser, planId: string) =>
  ok(await user.client.from('plans').select('id, plan_bridge').eq('id', planId).single())
    .plan_bridge;

beforeAll(async () => {
  [host, amiga, ana, zoe, segundo, tercero] = await Promise.all([
    bed.createUser('Bridge Host'),
    bed.createUser('Bridge Amiga'),
    bed.createUser('Bridge Ana'),
    bed.createUser('Bridge Zoe'),
    bed.createUser('Bridge Segundo'),
    bed.createUser('Bridge Tercero'),
  ]);
  await befriend(host, amiga);
  await befriend(host, ana);
  await befriend(host, zoe);
  await befriend(ana, segundo);
  await befriend(zoe, segundo);
  await befriend(zoe, tercero);
});

afterAll(async () => {
  if (planIds.length) {
    await bed.service.from('plans').delete().in('id', planIds);
  }
  await bed.dispose();
});

describe('plan_bridge', () => {
  it('names the friend a second-hop viewer shares with the host', async () => {
    const plan = await createPlan('friends_of_friends');
    const [toSegundo, toTercero] = await Promise.all([
      bridgeFor(segundo, plan),
      bridgeFor(tercero, plan),
    ]);
    expect({ toSegundo, toTercero }).toEqual({ toSegundo: 'Bridge Ana', toTercero: 'Bridge Zoe' });
  });

  it('is silent for the host and for a direct friend, who need no bridge', async () => {
    const plan = await createPlan('friends_of_friends');
    const [toHost, toAmiga] = await Promise.all([bridgeFor(host, plan), bridgeFor(amiga, plan)]);
    expect({ toHost, toAmiga }).toEqual({ toHost: null, toAmiga: null });
  });

  it('is silent on a friends plan and on a group plan', async () => {
    const group = await bed.createGroup(host);
    const [friendsPlan, groupPlan] = await Promise.all([
      createPlan('friends'),
      createPlan('group', group.id),
    ]);
    const [onFriends, onGroup] = await Promise.all([
      bridgeFor(amiga, friendsPlan),
      bridgeFor(host, groupPlan),
    ]);
    expect({ onFriends, onGroup }).toEqual({ onFriends: null, onGroup: null });
  });

  it('a bridge that blocked you is never named; the other bridge is', async () => {
    const plan = await createPlan('friends_of_friends');
    expect(await bridgeFor(segundo, plan)).toBe('Bridge Ana');

    ok(
      await ana.client
        .from('blocked_users')
        .insert({ blocker_id: ana.id, blocked_id: segundo.id }),
    );
    expect(await bridgeFor(segundo, plan)).toBe('Bridge Zoe');
  });
});
