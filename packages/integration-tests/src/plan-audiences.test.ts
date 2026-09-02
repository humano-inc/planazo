// PLA-139: a plan for all your friends, or for friends of friends, instead of
// a group. Sight is decided by can_view_plan, the one predicate every plan
// policy and satellite policy now asks, and seeing a plan is the invite: the
// rsvp write policies test visibility through their plans subqueries.
//
// The graph these tests walk, every edge an accepted friendship:
//
//   host - amiga                       a direct friend
//   host - puente - segundo            segundo is two hops, via puente
//   host - otro   - segundo            ...and again via otro (a second bridge)
//          puente - tercero            tercero is two hops, via puente alone
//                   segundo - tres     tres is three hops
//   lejano                             knows nobody
//
// Almost all of this is invisible from the client by construction (RLS making
// rows vanish, definer functions, a trigger fan-out), so this file is where
// the audiences and their shield behaviour actually get checked.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TestBed, TestUser, ok, daysFromNow } from './testbed';

const bed = new TestBed();

let host: TestUser;
let amiga: TestUser;
let puente: TestUser;
let otro: TestUser;
let segundo: TestUser;
let tercero: TestUser;
let tres: TestUser;
let lejano: TestUser;
let bloqueada: TestUser; // a friend the host blocks before posting

const planIds: string[] = [];

/** A crossing request is consent from both sides, so two calls make friends. */
async function befriend(a: TestUser, b: TestUser) {
  ok(await a.client.rpc('send_friend_request', { p_addressee: b.id }));
  const res = ok(await b.client.rpc('send_friend_request', { p_addressee: a.id })) as {
    status: string;
  };
  if (res.status !== 'accepted') {
    throw new Error(`befriend(${a.name}, ${b.name}) ended in ${res.status}`);
  }
}

const unfriend = (a: TestUser, b: TestUser) =>
  a.client
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${a.id},addressee_id.eq.${b.id}),and(requester_id.eq.${b.id},addressee_id.eq.${a.id})`,
    );

const block = (blocker: TestUser, blocked: TestUser) =>
  blocker.client
    .from('blocked_users')
    .insert({ blocker_id: blocker.id, blocked_id: blocked.id });

async function createPlan(
  creator: TestUser,
  audience: 'friends' | 'friends_of_friends',
  opts: { planType?: 'fixed' | 'flexible' } = {},
) {
  const planType = opts.planType ?? 'fixed';
  const id = ok(
    await creator.client
      .from('plans')
      .insert({
        audience,
        group_id: null,
        created_by: creator.id,
        title: `audience-${audience}-${randomUUID().slice(0, 8)}`,
        plan_type: planType,
        event_date: planType === 'fixed' ? daysFromNow(7) : null,
        min_people: 1,
      })
      .select('id')
      .single(),
  ).id;
  planIds.push(id);
  return id;
}

const sees = async (user: TestUser, planId: string) =>
  ok(await user.client.from('plans').select('id').eq('id', planId)).length === 1;

const say = (user: TestUser, planId: string, response: 'yes' | 'no' | 'pending') =>
  user.client
    .from('rsvps')
    .upsert({ plan_id: planId, user_id: user.id, response }, { onConflict: 'plan_id,user_id' });

async function wasNotified(userId: string, planId: string, type = 'plan_created') {
  const rows = ok(
    await bed.service
      .from('notifications')
      .select('user_id')
      .eq('type', type)
      .eq('user_id', userId)
      .filter('data->>plan_id', 'eq', planId),
  );
  return rows.length > 0;
}

beforeAll(async () => {
  [host, amiga, puente, otro, segundo, tercero, tres, lejano, bloqueada] = await Promise.all([
    bed.createUser('Audience Host'),
    bed.createUser('Audience Amiga'),
    bed.createUser('Audience Puente'),
    bed.createUser('Audience Otro'),
    bed.createUser('Audience Segundo'),
    bed.createUser('Audience Tercero'),
    bed.createUser('Audience Tres'),
    bed.createUser('Audience Lejano'),
    bed.createUser('Audience Bloqueada'),
  ]);
  // Sequential: send_friend_request locks rows per pair and the pairs share
  // people, so a burst of them is where deadlocks come from.
  await befriend(host, amiga);
  await befriend(host, puente);
  await befriend(host, otro);
  await befriend(host, bloqueada);
  await befriend(puente, segundo);
  await befriend(otro, segundo);
  await befriend(puente, tercero);
  await befriend(segundo, tres);
  ok(await block(host, bloqueada));
});

afterAll(async () => {
  // Group-less plans have no cascade to ride on; the creator's deletion only
  // nulls created_by and leaves the row.
  if (planIds.length) {
    await bed.service.from('plans').delete().in('id', planIds);
  }
  await bed.dispose();
});

describe('posting', () => {
  it('a friends plan needs no group, and a group plan still needs its group', async () => {
    const id = await createPlan(host, 'friends');
    const row = ok(
      await host.client.from('plans').select('audience, group_id').eq('id', id).single(),
    );
    expect(row).toEqual({ audience: 'friends', group_id: null });

    // Neither half of the pairing can be broken: a friends plan that also
    // names a group, or a group plan that names none.
    const group = await bed.createGroup(host);
    const mismatched = await host.client.from('plans').insert({
      audience: 'friends',
      group_id: group.id,
      created_by: host.id,
      title: 'mismatched',
      plan_type: 'fixed',
      event_date: daysFromNow(7),
      min_people: 1,
    });
    expect(mismatched.error?.message).toMatch(/plans_audience_matches_group/);

    const groupless = await host.client.from('plans').insert({
      audience: 'group',
      group_id: null,
      created_by: host.id,
      title: 'groupless',
      plan_type: 'fixed',
      event_date: daysFromNow(7),
      min_people: 1,
    });
    expect(groupless.error).toBeTruthy();

    // A group plan is unchanged: amiga is a friend, not a member, so the
    // group's plan does not exist for her, and she cannot post into it.
    const groupPlan = ok(
      await host.client
        .from('plans')
        .insert({
          group_id: group.id,
          created_by: host.id,
          title: 'for the group',
          plan_type: 'fixed',
          event_date: daysFromNow(7),
          min_people: 1,
        })
        .select('id, audience')
        .single(),
    );
    expect(groupPlan.audience).toBe('group');
    expect(await sees(amiga, groupPlan.id)).toBe(false);
    const intruder = await amiga.client.from('plans').insert({
      group_id: group.id,
      created_by: amiga.id,
      title: 'not a member',
      plan_type: 'fixed',
      event_date: daysFromNow(7),
      min_people: 1,
    });
    expect(intruder.error).toBeTruthy();
  });
});

describe('friends', () => {
  let plan: string;
  beforeAll(async () => {
    plan = await createPlan(host, 'friends');
  });

  it('is seen by the creator and their friends, and by nobody further out', async () => {
    const [byHost, byAmiga, byPuente, bySegundo, byLejano] = await Promise.all([
      sees(host, plan),
      sees(amiga, plan),
      sees(puente, plan),
      sees(segundo, plan),
      sees(lejano, plan),
    ]);
    expect({ byHost, byAmiga, byPuente, bySegundo, byLejano }).toEqual({
      byHost: true,
      byAmiga: true,
      byPuente: true,
      bySegundo: false,
      byLejano: false,
    });
  });

  it('seeing it is the invite: a friend can answer, a stranger cannot', async () => {
    ok(await say(amiga, plan, 'yes'));
    const stranger = await say(lejano, plan, 'yes');
    expect(stranger.error).toBeTruthy();
  });

  it('notifies the accepted friends and nobody the creator has blocked', async () => {
    const [toAmiga, toPuente, toOtro, toSegundo, toBloqueada, toLejano] = await Promise.all([
      wasNotified(amiga.id, plan),
      wasNotified(puente.id, plan),
      wasNotified(otro.id, plan),
      wasNotified(segundo.id, plan),
      wasNotified(bloqueada.id, plan),
      wasNotified(lejano.id, plan),
    ]);
    expect({ toAmiga, toPuente, toOtro, toSegundo, toBloqueada, toLejano }).toEqual({
      toAmiga: true,
      toPuente: true,
      toOtro: true,
      toSegundo: false,
      toBloqueada: false,
      toLejano: false,
    });
  });

  it('the satellites follow the plan: rsvps and polls are readable exactly by its viewers', async () => {
    ok(await say(host, plan, 'yes'));
    const poll = ok(
      await host.client
        .from('plan_polls')
        .insert({ plan_id: plan, question: 'Which night?' })
        .select('id')
        .single(),
    );

    const [amigaRsvps, lejanoRsvps, amigaPolls, lejanoPolls] = await Promise.all([
      amiga.client.from('rsvps').select('user_id').eq('plan_id', plan),
      lejano.client.from('rsvps').select('user_id').eq('plan_id', plan),
      amiga.client.from('plan_polls').select('id').eq('id', poll.id),
      lejano.client.from('plan_polls').select('id').eq('id', poll.id),
    ]);
    expect(ok(amigaRsvps).length).toBe(2);
    expect(ok(lejanoRsvps)).toEqual([]);
    expect(ok(amigaPolls).length).toBe(1);
    expect(ok(lejanoPolls)).toEqual([]);
  });

  it('a flexible friends plan carries its date options to the same people', async () => {
    const flexible = await createPlan(host, 'friends', { planType: 'flexible' });
    ok(
      await host.client
        .from('plan_date_options')
        .insert([
          { plan_id: flexible, date: daysFromNow(7) },
          { plan_id: flexible, date: daysFromNow(8) },
        ]),
    );
    const [byAmiga, byLejano] = await Promise.all([
      amiga.client.from('plan_date_options').select('id').eq('plan_id', flexible),
      lejano.client.from('plan_date_options').select('id').eq('plan_id', flexible),
    ]);
    expect(ok(byAmiga).length).toBe(2);
    expect(ok(byLejano)).toEqual([]);
  });

  it('the creator is the host: they can call it off and bring it back, an attendee cannot', async () => {
    const notHost = await amiga.client.rpc('cancel_plan', { p_plan_id: plan });
    expect(notHost.error).toBeTruthy();

    ok(await host.client.rpc('cancel_plan', { p_plan_id: plan }));
    expect(
      ok(await host.client.from('plans').select('status').eq('id', plan).single()).status,
    ).toBe('cancelled');

    ok(await host.client.rpc('restore_plan', { p_plan_id: plan }));
    expect(
      ok(await host.client.from('plans').select('status').eq('id', plan).single()).status,
    ).toBe('open');
  });

  it('a seat keeps its sight after the friendship ends; an empty hand loses it', async () => {
    const withSeat = await createPlan(host, 'friends');
    ok(await say(amiga, withSeat, 'yes'));

    // A second friend with no answer on this plan is the control.
    expect(await sees(otro, withSeat)).toBe(true);

    ok(await unfriend(host, amiga));
    ok(await unfriend(host, otro));
    const [amigaStill, otroStill] = await Promise.all([
      sees(amiga, withSeat),
      sees(otro, withSeat),
    ]);
    expect({ amigaStill, otroStill }).toEqual({ amigaStill: true, otroStill: false });

    // Put the graph back for the tests that follow.
    await befriend(host, amiga);
    await befriend(host, otro);
  });
});

describe('friends of friends', () => {
  let plan: string;
  beforeAll(async () => {
    plan = await createPlan(host, 'friends_of_friends');
  });

  it('is seen two hops out and no further', async () => {
    const [byAmiga, byPuente, bySegundo, byTercero, byTres, byLejano] = await Promise.all([
      sees(amiga, plan),
      sees(puente, plan),
      sees(segundo, plan),
      sees(tercero, plan),
      sees(tres, plan),
      sees(lejano, plan),
    ]);
    expect({ byAmiga, byPuente, bySegundo, byTercero, byTres, byLejano }).toEqual({
      byAmiga: true,
      byPuente: true,
      bySegundo: true,
      byTercero: true,
      byTres: false,
      byLejano: false,
    });
  });

  it('the second hop can answer', async () => {
    ok(await say(segundo, plan, 'yes'));
    const tooFar = await say(tres, plan, 'yes');
    expect(tooFar.error).toBeTruthy();
  });

  it('notifies direct friends only; the second hop finds it in the feed', async () => {
    const [toAmiga, toPuente, toSegundo, toTercero] = await Promise.all([
      wasNotified(amiga.id, plan),
      wasNotified(puente.id, plan),
      wasNotified(segundo.id, plan),
      wasNotified(tercero.id, plan),
    ]);
    expect({ toAmiga, toPuente, toSegundo, toTercero }).toEqual({
      toAmiga: true,
      toPuente: true,
      toSegundo: false,
      toTercero: false,
    });
  });
});

describe('the shield', () => {
  it('the creator blocking you erases their plans, whatever the audience', async () => {
    const [friendsPlan, fofPlan] = await Promise.all([
      createPlan(host, 'friends'),
      createPlan(host, 'friends_of_friends'),
    ]);
    // Blocking dissolves the friendship, so amiga is gone from the friends
    // audience either way; the block is what keeps her out of the FoF one,
    // where otro would otherwise bridge her straight back in.
    await befriend(amiga, otro);
    expect(await sees(amiga, fofPlan)).toBe(true);

    ok(await block(host, amiga));
    const [friendsStill, fofStill] = await Promise.all([
      sees(amiga, friendsPlan),
      sees(amiga, fofPlan),
    ]);
    expect({ friendsStill, fofStill }).toEqual({ friendsStill: false, fofStill: false });
  });

  it('a bridge that blocked you no longer carries sight; another bridge still does', async () => {
    const plan = await createPlan(host, 'friends_of_friends');
    expect(await sees(tercero, plan)).toBe(true);
    expect(await sees(segundo, plan)).toBe(true);

    // tercero reaches the host through puente alone.
    ok(await block(puente, tercero));
    expect(await sees(tercero, plan)).toBe(false);

    // segundo reaches the host through puente and through otro.
    ok(await block(puente, segundo));
    expect(await sees(segundo, plan)).toBe(true);
  });

  it('blocking the creator never hides them from you: your seat stays, and so does your sight', async () => {
    const plan = await createPlan(host, 'friends');
    ok(await say(puente, plan, 'yes'));

    ok(await block(puente, host));
    expect(await sees(puente, plan)).toBe(true);
    expect(
      ok(await puente.client.from('rsvps').select('response').eq('plan_id', plan)).map(
        (r) => r.response,
      ),
    ).toContain('yes');
  });
});
