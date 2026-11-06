// PLA-152: anyone who can see a plan can comment on it. Almost all of this is
// invisible from the client by construction (RLS making rows vanish, a definer
// predicate, a trigger fan-out), so this file is where it actually gets checked.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { COMMENT_MAX_LENGTH } from '@planazo/shared';
import { TestBed, TestUser, ok, daysFromNow } from './testbed';

const bed = new TestBed();

const planIds: string[] = [];

async function createPlan(
  host: TestUser,
  where: { groupId: string } | { audience: 'friends' | 'friends_of_friends' },
  opts: { planType?: 'fixed' | 'flexible' } = {},
) {
  const planType = opts.planType ?? 'fixed';
  const id = ok(
    await host.client
      .from('plans')
      .insert({
        ...('groupId' in where
          ? { group_id: where.groupId }
          : { audience: where.audience, group_id: null }),
        created_by: host.id,
        title: `it-comments-${randomUUID().slice(0, 8)}`,
        plan_type: planType,
        event_date: planType === 'fixed' ? daysFromNow(7) : null,
        min_people: 2,
      })
      .select('id')
      .single(),
  ).id;
  planIds.push(id);
  return id;
}

const comment = (author: TestUser, planId: string, body: string) =>
  author.client
    .from('plan_comments')
    .insert({ plan_id: planId, author_id: author.id, body })
    .select('id')
    .single();

/** Writes a comment that has to land, and hands back its id. */
const said = async (author: TestUser, planId: string, body: string) =>
  ok(await comment(author, planId, body)).id;

/** What a viewer reads, in the order the screen asks for it. */
const reads = async (viewer: TestUser, planId: string) =>
  ok(
    await viewer.client
      .from('plan_comments')
      .select('body')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true }),
  ).map((row) => row.body);

const stillThere = async (commentId: string) =>
  ok(await bed.service.from('plan_comments').select('id').eq('id', commentId)).length === 1;

const say = (user: TestUser, planId: string, response: 'yes' | 'no') =>
  user.client
    .from('rsvps')
    .upsert({ plan_id: planId, user_id: user.id, response }, { onConflict: 'plan_id,user_id' });

const block = (blocker: TestUser, blocked: TestUser) =>
  blocker.client
    .from('blocked_users')
    .insert({ blocker_id: blocker.id, blocked_id: blocked.id });

/** A crossing request is consent from both sides, so two calls make friends. */
async function befriend(a: TestUser, b: TestUser) {
  ok(await a.client.rpc('send_friend_request', { p_addressee: b.id }));
  ok(await b.client.rpc('send_friend_request', { p_addressee: a.id }));
}

/** Everyone a comment's fan-out wrote to, as the row they got. */
const pushesFor = async (commentId: string) =>
  ok(
    await bed.service
      .from('notifications')
      .select('user_id, title, body, data')
      .eq('type', 'plan_comment')
      .filter('data->>comment_id', 'eq', commentId),
  );

const pushedTo = async (commentId: string) =>
  (await pushesFor(commentId)).map((row) => row.user_id).sort();

const ids = (...users: TestUser[]) => users.map((user) => user.id).sort();

afterAll(async () => {
  if (planIds.length) await bed.service.from('plans').delete().in('id', planIds);
  await bed.dispose();
});

describe('a group plan', () => {
  let host: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let plan: string;

  beforeAll(async () => {
    [host, member, outsider] = await Promise.all([
      bed.createUser('Group Host'),
      bed.createUser('Group Member'),
      bed.createUser('Group Outsider'),
    ]);
    const group = await bed.createGroup(host);
    await bed.join(group.id, member);
    plan = await createPlan(host, { groupId: group.id });
  });

  it('is read and written by a member, oldest first', async () => {
    await said(host, plan, 'what time are we meeting?');
    await said(member, plan, 'running 10 minutes late');

    expect(await reads(member, plan)).toEqual([
      'what time are we meeting?',
      'running 10 minutes late',
    ]);
  });

  it('is neither read nor written by someone outside the group', async () => {
    expect(await reads(outsider, plan)).toEqual([]);
    expect((await comment(outsider, plan, 'let me in')).error?.code).toBe('42501');
  });

  it('refuses a comment signed with someone else\'s name', async () => {
    const forged = await member.client
      .from('plan_comments')
      .insert({ plan_id: plan, author_id: host.id, body: 'not actually me' });
    expect(forged.error?.code).toBe('42501');
  });

  it('refuses a comment dated by the client', async () => {
    const backdated = await member.client.from('plan_comments').insert({
      plan_id: plan,
      author_id: member.id,
      body: 'I said this first',
      created_at: '2020-01-01T00:00:00Z',
    });
    expect(backdated.error?.code).toBe('42501');
  });
});

describe('plans with no group', () => {
  let host: TestUser;
  let friend: TestUser;
  let bridge: TestUser;
  let twoHops: TestUser;
  let threeHops: TestUser;

  beforeAll(async () => {
    [host, friend, bridge, twoHops, threeHops] = await Promise.all([
      bed.createUser('Audience Host'),
      bed.createUser('Audience Friend'),
      bed.createUser('Audience Bridge'),
      bed.createUser('Audience TwoHops'),
      bed.createUser('Audience ThreeHops'),
    ]);
    // Sequential: send_friend_request locks rows per pair and the pairs share
    // people, so a burst of them is where deadlocks come from.
    await befriend(host, friend);
    await befriend(host, bridge);
    await befriend(bridge, twoHops);
    await befriend(twoHops, threeHops);
  });

  it('a friends plan takes comments from a friend and not from anyone further out', async () => {
    const plan = await createPlan(host, { audience: 'friends' });

    await said(friend, plan, 'in');
    expect(await reads(friend, plan)).toEqual(['in']);

    expect(await reads(twoHops, plan)).toEqual([]);
    expect((await comment(twoHops, plan, 'hello')).error?.code).toBe('42501');
  });

  it('a friends-of-friends plan lets two people who do not know each other talk', async () => {
    const plan = await createPlan(host, { audience: 'friends_of_friends' });

    await said(friend, plan, 'who is coming?');
    await said(twoHops, plan, 'me, via a friend');

    expect(await reads(twoHops, plan)).toEqual(['who is coming?', 'me, via a friend']);
    expect(await reads(friend, plan)).toEqual(['who is coming?', 'me, via a friend']);

    expect(await reads(threeHops, plan)).toEqual([]);
    expect((await comment(threeHops, plan, 'hello')).error?.code).toBe('42501');
  });
});

describe('a cancelled plan', () => {
  let host: TestUser;
  let member: TestUser;
  let plan: string;

  beforeAll(async () => {
    [host, member] = await Promise.all([
      bed.createUser('Cancel Host'),
      bed.createUser('Cancel Member'),
    ]);
    const group = await bed.createGroup(host);
    await bed.join(group.id, member);
    plan = await createPlan(host, { groupId: group.id });
    await said(member, plan, 'before it was called off');
    ok(await host.client.rpc('cancel_plan', { p_plan_id: plan, p_reason: 'rain' }));
  });

  it('stays readable and takes no new comments', async () => {
    expect(await reads(member, plan)).toEqual(['before it was called off']);
    expect((await comment(member, plan, 'too late')).error?.code).toBe('42501');
    expect((await comment(host, plan, 'too late')).error?.code).toBe('42501');
  });

  it('takes them again once it is back on', async () => {
    ok(await host.client.rpc('restore_plan', { p_plan_id: plan }));
    await said(member, plan, 'back on');
    expect(await reads(member, plan)).toEqual(['before it was called off', 'back on']);
  });
});

describe('the shield rule', () => {
  let host: TestUser;
  let author: TestUser;
  let blocked: TestUser;
  let plan: string;

  beforeAll(async () => {
    [host, author, blocked] = await Promise.all([
      bed.createUser('Shield Host'),
      bed.createUser('Shield Author'),
      bed.createUser('Shield Blocked'),
    ]);
    const group = await bed.createGroup(host);
    await bed.join(group.id, author);
    await bed.join(group.id, blocked);
    plan = await createPlan(host, { groupId: group.id });

    await said(author, plan, 'from the blocker');
    await said(blocked, plan, 'from the blocked');
    ok(await block(author, blocked));
  });

  it("takes the blocker's comments away from the person they blocked", async () => {
    expect(await reads(blocked, plan)).toEqual(['from the blocked']);
  });

  it('leaves the blocker seeing the blocked person exactly as before', async () => {
    expect(await reads(author, plan)).toEqual(['from the blocker', 'from the blocked']);
  });

  it('counts only what the viewer can read, so the count cannot announce the block', async () => {
    const count = async (viewer: TestUser) =>
      (
        await viewer.client
          .from('plan_comments')
          .select('id', { count: 'exact', head: true })
          .eq('plan_id', plan)
      ).count;

    expect(await count(blocked)).toBe(1);
    expect(await count(author)).toBe(2);
    expect(await count(host)).toBe(2);
  });

  it('lets the blocked person still comment on a plan the blocker did not post', async () => {
    await said(blocked, plan, 'still here');
    expect(await reads(author, plan)).toContain('still here');
  });

  it("takes the whole list away when it is the host who blocks", async () => {
    const [hostWhoBlocks, member] = await Promise.all([
      bed.createUser('Shield Blocking Host'),
      bed.createUser('Shield Group Member'),
    ]);
    const group = await bed.createGroup(hostWhoBlocks);
    await bed.join(group.id, member);
    const hostsPlan = await createPlan(hostWhoBlocks, { groupId: group.id });
    await said(member, hostsPlan, 'mine, from before the block');

    ok(await block(hostWhoBlocks, member));

    expect(await reads(member, hostsPlan)).toEqual([]);
    expect((await comment(member, hostsPlan, 'hello?')).error?.code).toBe('42501');
  });
});

describe('deleting and editing', () => {
  let host: TestUser;
  let author: TestUser;
  let other: TestUser;
  let plan: string;

  beforeAll(async () => {
    [host, author, other] = await Promise.all([
      bed.createUser('Delete Host'),
      bed.createUser('Delete Author'),
      bed.createUser('Delete Other'),
    ]);
    const group = await bed.createGroup(host);
    await bed.join(group.id, author);
    await bed.join(group.id, other);
    plan = await createPlan(host, { groupId: group.id });
  });

  it('lets the author delete their own', async () => {
    const id = await said(author, plan, 'take this back');
    ok(await author.client.from('plan_comments').delete().eq('id', id));
    expect(await stillThere(id)).toBe(false);
  });

  it('does not let the host or anyone else delete it', async () => {
    const id = await said(author, plan, 'mine to keep');
    ok(await host.client.from('plan_comments').delete().eq('id', id));
    ok(await other.client.from('plan_comments').delete().eq('id', id));
    expect(await stillThere(id)).toBe(true);
  });

  it('refuses an edit, even from the author', async () => {
    const id = await said(author, plan, 'as I wrote it');
    const edit = await author.client
      .from('plan_comments')
      .update({ body: 'as I wish I had' })
      .eq('id', id);
    expect(edit.error?.code).toBe('42501');

    const row = ok(await bed.service.from('plan_comments').select('body').eq('id', id).single());
    expect(row.body).toBe('as I wrote it');
  });
});

describe('length', () => {
  let host: TestUser;
  let plan: string;

  beforeAll(async () => {
    host = await bed.createUser('Length Host');
    const group = await bed.createGroup(host);
    plan = await createPlan(host, { groupId: group.id });
  });

  it.each([
    ['empty', ''],
    ['spaces', '    '],
    // A bare btrim() strips spaces and nothing else, so these two are the reason
    // the constraint names its characters.
    ['newlines and tabs', '\n\t\r\n'],
    ['non-breaking and ideographic spaces', ' 　'],
    ['one past the limit', 'a'.repeat(COMMENT_MAX_LENGTH + 1)],
  ])('refuses %s', async (_name, body) => {
    expect((await comment(host, plan, body)).error?.code).toBe('23514');
  });

  it.each([
    ['one character', 'a'],
    ['exactly the limit', 'a'.repeat(COMMENT_MAX_LENGTH)],
    ['the limit, with whitespace around it', ` \n${'a'.repeat(COMMENT_MAX_LENGTH)}\n `],
    ['the limit in emoji, counted the way the client counts', '🎉'.repeat(COMMENT_MAX_LENGTH)],
    ['a body with a v in it', 'vvv'],
  ])('takes %s', async (_name, body) => {
    expect((await comment(host, plan, body)).error).toBeNull();
  });
});

describe('the fan-out', () => {
  let host: TestUser;
  let yes: TestUser;
  let no: TestUser;
  let bystander: TestUser;
  let earlier: TestUser;
  let author: TestUser;
  let groupId: string;

  beforeAll(async () => {
    [host, yes, no, bystander, earlier, author] = await Promise.all([
      bed.createUser('Fanout Host'),
      bed.createUser('Fanout Yes'),
      bed.createUser('Fanout No'),
      bed.createUser('Fanout Bystander'),
      bed.createUser('Fanout Earlier'),
      bed.createUser('Fanout Author'),
    ]);
    groupId = (await bed.createGroup(host)).id;
    await Promise.all(
      [yes, no, bystander, earlier, author].map((user) => bed.join(groupId, user)),
    );
  });

  it('notifies the host, the people going and earlier commenters, never the author', async () => {
    const plan = await createPlan(host, { groupId });
    ok(await say(yes, plan, 'yes'));
    ok(await say(no, plan, 'no'));
    await said(earlier, plan, 'first');

    const id = await said(author, plan, 'second');

    expect(await pushedTo(id)).toEqual(ids(host, yes, earlier));
  });

  it('does not notify someone twice for being two of those things', async () => {
    const plan = await createPlan(host, { groupId });
    ok(await say(yes, plan, 'yes'));
    await said(yes, plan, 'going, and commenting');

    const id = await said(author, plan, 'hello');

    expect(await pushedTo(id)).toEqual(ids(host, yes));
  });

  it('notifies a host who comments on nobody but themselves about nobody', async () => {
    const plan = await createPlan(host, { groupId });
    const id = await said(host, plan, 'talking to myself');
    expect(await pushedTo(id)).toEqual([]);
  });

  it('titles the push with the plan, and names who said what', async () => {
    const plan = await createPlan(host, { groupId });
    const id = await said(author, plan, "I'll bring the speaker");
    const title = ok(await bed.service.from('plans').select('title').eq('id', plan).single()).title;

    const [push] = await pushesFor(id);
    expect(push?.title).toBe(title);
    expect(push?.body).toBe("Fanout Author: I'll bring the speaker");
    expect(push?.data).toEqual({ plan_id: plan, group_id: groupId, comment_id: id });
  });

  it('gives a long comment one truncated line', async () => {
    const plan = await createPlan(host, { groupId });
    const id = await said(author, plan, `first line\n\n${'a'.repeat(400)}`);

    const [push] = await pushesFor(id);
    expect(push?.body.startsWith('Fanout Author: first line aaa')).toBe(true);
    expect(push?.body.endsWith('…')).toBe(true);
    expect(push?.body.length).toBeLessThanOrEqual('Fanout Author: '.length + 140);
    expect(push?.body).not.toContain('\n');
  });

  it('counts availability as going while a flexible vote is running, and not after', async () => {
    const plan = await createPlan(host, { groupId }, { planType: 'flexible' });
    const [picked, other] = ok(
      await host.client
        .from('plan_date_options')
        .insert([
          { plan_id: plan, date: daysFromNow(5) },
          { plan_id: plan, date: daysFromNow(6) },
        ])
        .select('id'),
    );
    ok(
      await yes.client
        .from('date_availability')
        .insert({ plan_id: plan, user_id: yes.id, date_option_id: picked!.id, available: true }),
    );
    ok(
      await bystander.client.from('date_availability').insert({
        plan_id: plan,
        user_id: bystander.id,
        date_option_id: picked!.id,
        available: true,
      }),
    );
    ok(
      await no.client
        .from('date_availability')
        .insert({ plan_id: plan, user_id: no.id, date_option_id: other!.id, available: true }),
    );

    const during = await said(author, plan, 'which day?');
    expect(await pushedTo(during)).toEqual(ids(host, yes, bystander, no));

    // The lock seats whoever could make the date it landed on, so the person who
    // could only do the other one is no longer going.
    const locked = ok(
      await host.client.rpc('lock_plan', { p_plan_id: plan, p_date_option_id: picked!.id }),
    );
    expect(locked).toMatchObject({ locked: true });

    const after = await said(earlier, plan, 'see you then');
    expect(await pushedTo(after)).toEqual(ids(host, yes, bystander, author));
  });

  it('does not notify a commenter who has since left the group', async () => {
    const leaver = await bed.createUser('Fanout Leaver');
    await bed.join(groupId, leaver);
    const plan = await createPlan(host, { groupId });
    await said(leaver, plan, 'see you all there');

    const before = await said(author, plan, 'see you');
    expect(await pushedTo(before)).toContain(leaver.id);

    ok(await leaver.client.rpc('leave_group', { p_group_id: groupId }));

    const after = await said(author, plan, 'where did they go?');
    expect(await pushedTo(after)).not.toContain(leaver.id);
  });

  it("is silenced by the author's blocks and by nobody else's", async () => {
    const [blockedByAuthor, blockerOfAuthor, chatty] = await Promise.all([
      bed.createUser('Fanout BlockedByAuthor'),
      bed.createUser('Fanout BlockerOfAuthor'),
      bed.createUser('Fanout Chatty'),
    ]);
    await Promise.all(
      [blockedByAuthor, blockerOfAuthor, chatty].map((user) => bed.join(groupId, user)),
    );
    const plan = await createPlan(host, { groupId });
    ok(await say(blockedByAuthor, plan, 'yes'));
    ok(await say(blockerOfAuthor, plan, 'yes'));

    ok(await block(chatty, blockedByAuthor));
    ok(await block(blockerOfAuthor, chatty));

    const id = await said(chatty, plan, 'hello');
    const recipients = await pushedTo(id);

    expect(recipients).not.toContain(blockedByAuthor.id);
    expect(recipients).toContain(blockerOfAuthor.id);
  });

  it('does not notify someone the host has blocked, because they cannot see the plan', async () => {
    const [hostWhoBlocks, commenter, poster] = await Promise.all([
      bed.createUser('Fanout Blocking Host'),
      bed.createUser('Fanout Former Guest'),
      bed.createUser('Fanout Poster'),
    ]);
    const group = await bed.createGroup(hostWhoBlocks);
    await bed.join(group.id, commenter);
    await bed.join(group.id, poster);
    const plan = await createPlan(hostWhoBlocks, { groupId: group.id });
    await said(commenter, plan, 'from before the block');

    ok(await block(hostWhoBlocks, commenter));

    const id = await said(poster, plan, 'hello');
    expect(await pushedTo(id)).toEqual(ids(hostWhoBlocks));
  });

  it('reaches a friend of a friend on a plan with no group, and only while they can see it', async () => {
    const [fofHost, bridge, secondHop, poster] = await Promise.all([
      bed.createUser('Fanout FoF Host'),
      bed.createUser('Fanout FoF Bridge'),
      bed.createUser('Fanout FoF SecondHop'),
      bed.createUser('Fanout FoF Poster'),
    ]);
    await befriend(fofHost, bridge);
    await befriend(bridge, secondHop);
    await befriend(fofHost, poster);
    const plan = await createPlan(fofHost, { audience: 'friends_of_friends' });
    await said(secondHop, plan, 'hi, I know the bridge');

    const before = await said(poster, plan, 'hi');
    expect(await pushedTo(before)).toEqual(ids(fofHost, secondHop));

    // The bridge blocking them takes away the sight it was carrying.
    ok(await block(bridge, secondHop));

    const after = await said(poster, plan, 'anyone?');
    expect(await pushedTo(after)).toEqual(ids(fofHost));
  });

  it('still works on a plan whose host deleted their account', async () => {
    const [goneHost, heir, commenter] = await Promise.all([
      bed.createUser('Fanout Gone Host'),
      bed.createUser('Fanout Heir'),
      bed.createUser('Fanout Orphan Commenter'),
    ]);
    const group = await bed.createGroup(goneHost);
    await bed.join(group.id, heir);
    await bed.join(group.id, commenter);
    const plan = await createPlan(goneHost, { groupId: group.id });
    ok(await say(heir, plan, 'yes'));

    ok(await goneHost.client.rpc('delete_my_account'));

    const id = await said(commenter, plan, 'is this still on?');
    expect(await pushedTo(id)).toEqual(ids(heir));
  });
});

describe('the private form of can_view_plan', () => {
  it('cannot be called by a client', async () => {
    const [asker, other] = await Promise.all([
      bed.createUser('Private Asker'),
      bed.createUser('Private Other'),
    ]);
    const group = await bed.createGroup(asker);
    const plan = await createPlan(asker, { groupId: group.id });

    const res = await asker.client.rpc('can_view_plan_as', {
      p_viewer: other.id,
      p_plan_id: plan,
      p_audience: 'group',
      p_group_id: group.id,
      p_created_by: asker.id,
    });
    expect(res.error?.code).toBe('42501');
  });
});

describe('account deletion', () => {
  it("takes the person's comments and leaves everyone else's", async () => {
    const [host, leaving] = await Promise.all([
      bed.createUser('Deletion Host'),
      bed.createUser('Deletion Leaving'),
    ]);
    const group = await bed.createGroup(host);
    await bed.join(group.id, leaving);
    const plan = await createPlan(host, { groupId: group.id });
    const theirs = await said(leaving, plan, 'gone with me');
    const hosts = await said(host, plan, 'still here');

    ok(await leaving.client.rpc('delete_my_account'));

    expect(await stillThere(theirs)).toBe(false);
    expect(await stillThere(hosts)).toBe(true);
  });
});

describe('reporting', () => {
  let host: TestUser;
  let reporter: TestUser;
  let plan: string;

  beforeAll(async () => {
    [host, reporter] = await Promise.all([
      bed.createUser('Report Host'),
      bed.createUser('Report Reporter'),
    ]);
    const group = await bed.createGroup(host);
    await bed.join(group.id, reporter);
    plan = await createPlan(host, { groupId: group.id });
  });

  it('accepts a comment as the subject', async () => {
    const id = await said(host, plan, 'something objectionable');
    ok(
      await reporter.client.rpc('file_report', {
        p_subject_type: 'comment',
        p_subject_id: id,
        p_reason: 'harassment',
      }),
    );

    const rows = ok(
      await bed.service
        .from('content_reports')
        .select('reporter_id, subject_type')
        .eq('subject_id', id),
    );
    expect(rows).toEqual([{ reporter_id: reporter.id, subject_type: 'comment' }]);
  });

  it('blocks them too, in the same gesture', async () => {
    const [author, blocker] = await Promise.all([
      bed.createUser('Report Author'),
      bed.createUser('Report Blocker'),
    ]);
    const group = await bed.createGroup(author);
    await bed.join(group.id, blocker);
    const authorsPlan = await createPlan(author, { groupId: group.id });
    const id = await said(author, authorsPlan, 'something else objectionable');

    ok(
      await blocker.client.rpc('file_report', {
        p_subject_type: 'comment',
        p_subject_id: id,
        p_reason: 'hate',
        p_block_user_id: author.id,
      }),
    );

    const rows = ok(
      await bed.service
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', blocker.id),
    );
    expect(rows).toEqual([{ blocked_id: author.id }]);
  });
});
