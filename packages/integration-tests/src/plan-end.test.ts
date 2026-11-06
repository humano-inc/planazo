// A plan's end (PLA-157): the column's rule, who can change it, lock_plan
// setting it, and every server-side test of whether a plan is over reading it.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestBed, TestUser, ok, daysFromNow } from './testbed';

const bed = new TestBed();
let host: TestUser;
let member: TestUser;
let other: TestUser;
let groupId: string;

const HOUR = 3_600_000;
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();
const sameInstant = (a: string | null | undefined, b: string) =>
  expect(new Date(a ?? 0).getTime()).toBe(new Date(b).getTime());

/** A CHECK violation, which is what plans_ends_after_start raises. */
const CHECK_VIOLATION = '23514';
/** Postgres insufficient_privilege: the column grant said no. */
const NO_PRIVILEGE = '42501';

function insertFixed(opts: { start: string; end: string | null; maxPeople?: number }) {
  return host.client
    .from('plans')
    .insert({
      group_id: groupId,
      created_by: host.id,
      title: 'plan-end fixed',
      plan_type: 'fixed',
      event_date: opts.start,
      ends_at: opts.end,
      min_people: 2,
      max_people: opts.maxPeople ?? null,
    })
    .select('id')
    .single();
}

async function createFixed(opts: { start: string; end: string | null; maxPeople?: number }) {
  return ok(await insertFixed(opts)).id;
}

/** A vote with one date that two people are free on, so it can lock. */
async function createVote(optionDate: string) {
  const planId = ok(
    await host.client
      .from('plans')
      .insert({
        group_id: groupId,
        created_by: host.id,
        title: 'plan-end vote',
        plan_type: 'flexible',
        min_people: 2,
      })
      .select('id')
      .single(),
  ).id;
  const optionId = ok(
    await host.client
      .from('plan_date_options')
      .insert({ plan_id: planId, date: optionDate })
      .select('id')
      .single(),
  ).id;
  for (const user of [host, member]) {
    ok(
      await user.client.from('date_availability').insert({
        plan_id: planId,
        user_id: user.id,
        date_option_id: optionId,
        available: true,
      }),
    );
  }
  return { planId, optionId };
}

const readPlan = async (planId: string) =>
  ok(
    await bed.service
      .from('plans')
      .select('status, locked_date, ends_at')
      .eq('id', planId)
      .single(),
  );

const say = (user: TestUser, planId: string, response: 'yes' | 'pending') =>
  user.client
    .from('rsvps')
    .upsert({ plan_id: planId, user_id: user.id, response }, { onConflict: 'plan_id,user_id' });

const responseOf = async (planId: string, userId: string) =>
  (
    await bed.service
      .from('rsvps')
      .select('response')
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .maybeSingle()
  ).data?.response ?? null;

beforeAll(async () => {
  [host, member, other] = await Promise.all([
    bed.createUser('End Host'),
    bed.createUser('End Member'),
    bed.createUser('End Other'),
  ]);
  groupId = (await bed.createGroup(host)).id;
  await bed.join(groupId, member);
  await bed.join(groupId, other);
});

afterAll(() => bed.dispose());

describe('plans.ends_at', () => {
  it('takes an end after the start', async () => {
    const end = daysFromNow(7.1);
    const planId = await createFixed({ start: daysFromNow(7), end });
    sameInstant((await readPlan(planId)).ends_at, end);
  });

  it('is optional', async () => {
    const planId = await createFixed({ start: daysFromNow(7), end: null });
    expect((await readPlan(planId)).ends_at).toBeNull();
  });

  it('refuses an end at or before the start', async () => {
    const start = daysFromNow(7);
    expect((await insertFixed({ start, end: start })).error?.code).toBe(CHECK_VIOLATION);
    expect((await insertFixed({ start, end: daysFromNow(6) })).error?.code).toBe(CHECK_VIOLATION);
  });

  it('refuses an end on a vote nobody has locked', async () => {
    const res = await host.client.from('plans').insert({
      group_id: groupId,
      created_by: host.id,
      title: 'plan-end open vote',
      plan_type: 'flexible',
      ends_at: daysFromNow(7),
      min_people: 2,
    });
    expect(res.error?.code).toBe(CHECK_VIOLATION);
  });

  it('lets the host change the end, under the same rule', async () => {
    const start = daysFromNow(7);
    const planId = await createFixed({ start, end: daysFromNow(7.1) });

    const later = daysFromNow(9);
    ok(await host.client.from('plans').update({ ends_at: later }).eq('id', planId).select('id'));
    sameInstant((await readPlan(planId)).ends_at, later);

    const refused = await host.client.from('plans').update({ ends_at: start }).eq('id', planId);
    expect(refused.error?.code).toBe(CHECK_VIOLATION);
  });

  it('lets the host remove it', async () => {
    const planId = await createFixed({ start: daysFromNow(7), end: daysFromNow(7.1) });

    ok(await host.client.from('plans').update({ ends_at: null }).eq('id', planId).select('id'));

    expect((await readPlan(planId)).ends_at).toBeNull();
  });

  it('does not let anyone but the host change it', async () => {
    const end = daysFromNow(7.1);
    const planId = await createFixed({ start: daysFromNow(7), end });

    const rows = ok(
      await member.client
        .from('plans')
        .update({ ends_at: daysFromNow(9) })
        .eq('id', planId)
        .select('id'),
    );

    expect(rows).toEqual([]);
    sameInstant((await readPlan(planId)).ends_at, end);
  });

  it('leaves the start out of reach, even for the host', async () => {
    const planId = await createFixed({ start: daysFromNow(7), end: daysFromNow(7.1) });
    const res = await host.client
      .from('plans')
      .update({ event_date: daysFromNow(6) })
      .eq('id', planId);
    expect(res.error?.code).toBe(NO_PRIVILEGE);
  });
});

describe('lock_plan with times', () => {
  it('sets the start and the end the host chose', async () => {
    const option = daysFromNow(10);
    const { planId, optionId } = await createVote(option);
    const start = daysFromNow(10.5);
    const end = daysFromNow(10.6);

    const res = ok(
      await host.client.rpc('lock_plan', {
        p_plan_id: planId,
        p_date_option_id: optionId,
        p_starts_at: start,
        p_ends_at: end,
      }),
    ) as { locked: boolean; locked_date: string };

    expect(res.locked).toBe(true);
    sameInstant(res.locked_date, start);
    const plan = await readPlan(planId);
    expect(plan.status).toBe('locked');
    sameInstant(plan.locked_date, start);
    sameInstant(plan.ends_at, end);
  });

  it('takes a start with no end', async () => {
    const { planId, optionId } = await createVote(daysFromNow(10));
    const start = daysFromNow(10.5);

    ok(
      await host.client.rpc('lock_plan', {
        p_plan_id: planId,
        p_date_option_id: optionId,
        p_starts_at: start,
      }),
    );

    const plan = await readPlan(planId);
    sameInstant(plan.locked_date, start);
    expect(plan.ends_at).toBeNull();
  });

  it('still locks the old way for an app that has not updated', async () => {
    const option = daysFromNow(10);
    const { planId, optionId } = await createVote(option);

    ok(await host.client.rpc('lock_plan', { p_plan_id: planId, p_date_option_id: optionId }));

    const plan = await readPlan(planId);
    expect(plan.status).toBe('locked');
    sameInstant(plan.locked_date, option);
    expect(plan.ends_at).toBeNull();
  });

  it('refuses an end that is not after the start, and leaves the vote running', async () => {
    const { planId, optionId } = await createVote(daysFromNow(10));

    const res = await host.client.rpc('lock_plan', {
      p_plan_id: planId,
      p_date_option_id: optionId,
      p_starts_at: daysFromNow(10.5),
      p_ends_at: daysFromNow(10.4),
    });

    expect(res.error?.code).toBe(CHECK_VIOLATION);
    expect((await readPlan(planId)).status).toBe('open');
  });

  it('refuses a start that is not on the date the vote chose', async () => {
    const { planId, optionId } = await createVote(daysFromNow(10));

    const res = await host.client.rpc('lock_plan', {
      p_plan_id: planId,
      p_date_option_id: optionId,
      p_starts_at: daysFromNow(20),
      p_ends_at: daysFromNow(20.1),
    });

    expect(res.error?.message).toMatch(/not on the chosen date/);
    expect((await readPlan(planId)).status).toBe('open');
  });

  it('allows a host in another timezone, whose day starts hours away', async () => {
    const option = daysFromNow(10);
    const { planId, optionId } = await createVote(option);

    ok(
      await host.client.rpc('lock_plan', {
        p_plan_id: planId,
        p_date_option_id: optionId,
        p_starts_at: new Date(new Date(option).getTime() - 10 * HOUR).toISOString(),
        p_ends_at: new Date(new Date(option).getTime() - 8 * HOUR).toISOString(),
      }),
    );

    expect((await readPlan(planId)).status).toBe('locked');
  });

  it('reopening the vote clears the end along with the date', async () => {
    const { planId, optionId } = await createVote(daysFromNow(10));
    ok(
      await host.client.rpc('lock_plan', {
        p_plan_id: planId,
        p_date_option_id: optionId,
        p_starts_at: daysFromNow(10.5),
        p_ends_at: daysFromNow(10.6),
      }),
    );

    ok(await host.client.rpc('reopen_plan', { p_plan_id: planId }));

    const plan = await readPlan(planId);
    expect(plan.status).toBe('open');
    expect(plan.locked_date).toBeNull();
    expect(plan.ends_at).toBeNull();
  });
});

describe('restore_plan reads the end', () => {
  const restoreAfterCancelling = async (start: string, end: string | null) => {
    const planId = await createFixed({ start, end });
    ok(await host.client.rpc('cancel_plan', { p_plan_id: planId }));
    return host.client.rpc('restore_plan', { p_plan_id: planId });
  };

  it('restores a weekend away that started days ago and has not ended', async () => {
    const res = await restoreAfterCancelling(daysFromNow(-3), daysFromNow(1));
    expect(res.error).toBeNull();
  });

  it('refuses a plan that has ended, with no day of grace', async () => {
    const res = await restoreAfterCancelling(hoursFromNow(-3), hoursFromNow(-1));
    expect(res.error?.message).toMatch(/The date has passed/);
  });

  it('keeps the day of grace on a plan with no end', async () => {
    const res = await restoreAfterCancelling(hoursFromNow(-3), null);
    expect(res.error).toBeNull();
  });
});

describe('promote_from_waitlist reads the end', () => {
  const freeASeat = async (start: string, end: string | null) => {
    const planId = await createFixed({ start, end, maxPeople: 1 });
    ok(await say(member, planId, 'yes'));
    ok(await say(other, planId, 'pending'));
    ok(await member.client.from('rsvps').delete().eq('plan_id', planId).eq('user_id', member.id));
    return responseOf(planId, other.id);
  };

  it('promotes on a plan that started days ago and is still running', async () => {
    expect(await freeASeat(daysFromNow(-3), daysFromNow(1))).toBe('yes');
  });

  it('promotes nobody once the plan has ended', async () => {
    expect(await freeASeat(hoursFromNow(-3), hoursFromNow(-1))).toBe('pending');
  });
});

describe('a block dissolves seats by the end', () => {
  it('takes a seat on a plan still running, and leaves one on a plan that has ended', async () => {
    const blocker = await bed.createUser('End Blocker');
    const blocked = await bed.createUser('End Blocked');
    const group = await bed.createGroup(blocker);
    await bed.join(group.id, blocked);

    const planBy = async (start: string, end: string) =>
      ok(
        await blocker.client
          .from('plans')
          .insert({
            group_id: group.id,
            created_by: blocker.id,
            title: 'plan-end block',
            plan_type: 'fixed',
            event_date: start,
            ends_at: end,
            min_people: 2,
          })
          .select('id')
          .single(),
      ).id;

    const running = await planBy(daysFromNow(-3), daysFromNow(1));
    const ended = await planBy(hoursFromNow(-3), hoursFromNow(-1));
    ok(await say(blocked, running, 'yes'));
    ok(await say(blocked, ended, 'yes'));

    ok(
      await blocker.client
        .from('blocked_users')
        .insert({ blocker_id: blocker.id, blocked_id: blocked.id }),
    );

    expect(await responseOf(running, blocked.id)).toBeNull();
    expect(await responseOf(ended, blocked.id)).toBe('yes');
  });
});
