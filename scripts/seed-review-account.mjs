/**
 * Seeds the account App Review and Play Console sign in with.
 *
 * Both stores hit the same wall: Planazo is invite-only, so a fresh account
 * sees an empty app and an empty app gets rejected. This builds the smallest
 * world that makes the walkthrough in store-assets/APP-STORE.md §5 work, and
 * nothing else.
 *
 * Deliberately NOT seed-demo-data.mjs, which is built for a throwaway database
 * and does three things you never want on production: it grants the primary
 * account app-admin, it writes fake feedback, and when SEED_PRIMARY_EMAIL is
 * unset it picks the first existing auth user, which on production is a real
 * person.
 *
 *   REVIEW_SEED_CONFIRM=<project-ref> REVIEW_SEED_PASSWORD=<password> \
 *     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-review-account.mjs
 *
 * Re-running is safe: accounts and groups are matched on email and invite code,
 * and the plans in those two groups are replaced.
 */
import { createClient } from '@supabase/supabase-js';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/+$/, '');
const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const password = requiredEnv('REVIEW_SEED_PASSWORD');

// The guard the demo seed gets backwards. That one refuses production; this one
// is meant for it, so instead of a yes/no flag it asks you to name the project
// you think you are writing to. A stale SUPABASE_URL then fails loudly rather
// than seeding the wrong database.
const projectRef = requiredEnv('REVIEW_SEED_CONFIRM');
if (!supabaseUrl.includes(projectRef)) {
  throw new Error(
    `REVIEW_SEED_CONFIRM is "${projectRef}" but SUPABASE_URL is ${supabaseUrl}.\n` +
      'Point them at the same project, or fix whichever one is wrong.'
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REVIEW_EMAIL = 'review@planazo.me';

/** The reviewer, plus enough people to make a group look like a group. */
const people = [
  { handle: 'review', email: REVIEW_EMAIL, displayName: 'Planazo Review' },
  { handle: 'alex', email: 'review.alex@example.com', displayName: 'Alex Rivera' },
  { handle: 'bianca', email: 'review.bianca@example.com', displayName: 'Bianca Stone' },
  { handle: 'diego', email: 'review.diego@example.com', displayName: 'Diego Morales' },
  { handle: 'lucia', email: 'review.lucia@example.com', displayName: 'Lucia Chen' },
  { handle: 'theo', email: 'review.theo@example.com', displayName: 'Theo Brooks' },
];

/**
 * Invite codes use `generate_invite_code`'s alphabet
 * (ABCDEFGHJKLMNPQRSTUVWXYZ23456789), which drops the characters that read as
 * each other: no 0, 1, I or O. A code outside it opens as a link and is then
 * refused by the paste field, which checks the same rule.
 */
const groups = [
  {
    key: 'weekend',
    inviteCode: 'REVWKEND',
    name: 'Weekend Crew',
    description: 'Low-pressure plans for Saturdays, Sundays, and last-minute ideas.',
    citySlug: 'mendoza',
    admins: ['review', 'alex'],
    members: ['review', 'alex', 'bianca', 'diego', 'lucia'],
  },
  {
    key: 'food',
    inviteCode: 'REVFEAST',
    name: 'Food & Drinks',
    description: 'Restaurants, bars, pop-ups, and dinner experiments.',
    // A second city so the reviewer sees that a group has one and that two
    // groups can differ, rather than a field that is the same everywhere.
    citySlug: 'buenos-aires',
    admins: ['alex'],
    members: ['review', 'alex', 'bianca', 'theo', 'lucia'],
  },
];

function dateFromNow(days, hour = 19, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function dayFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * One plan per step of the review walkthrough.
 *
 * The reviewer answers nothing in advance on the first two: "I'm in" and "Send
 * my dates" are the two things the notes ask them to try, and a plan they have
 * already answered offers neither.
 */
const plans = [
  {
    key: 'pizza',
    groupKey: 'food',
    createdBy: 'alex',
    title: 'Rooftop pizza night',
    description: 'Trying the new sourdough place and splitting a few pies.',
    location: 'Terraza Centro',
    plan_type: 'fixed',
    event_date: dateFromNow(6, 20, 30),
    min_people: 4,
    max_people: 10,
    // Three in, one out, minimum four: the reviewer's yes is the one that
    // confirms it, so the slot bar visibly fills and the status flips.
    rsvps: { yes: ['alex', 'bianca', 'theo'], no: ['lucia'] },
  },
  {
    key: 'padel',
    groupKey: 'weekend',
    createdBy: 'bianca',
    title: 'Padel, some weeknight',
    description: 'Court for four. Tick whichever evenings work and we will take the winner.',
    location: 'Club Norte',
    plan_type: 'flexible',
    min_people: 4,
    max_people: 4,
    dateOptions: [dayFromNow(9), dayFromNow(10), dayFromNow(11)],
    availability: {
      alex: [0, 1],
      diego: [1, 2],
      lucia: [1],
    },
  },
  {
    key: 'hike',
    groupKey: 'weekend',
    createdBy: 'diego',
    title: 'Sunrise hike at Cerro Arco',
    description: 'Easy pace, snacks at the top, and coffee afterwards.',
    location: 'Cerro Arco trailhead',
    plan_type: 'fixed',
    event_date: dateFromNow(13, 8),
    min_people: 3,
    max_people: 8,
    // Already past its minimum, so the feed shows a confirmed plan next to one
    // still waiting. The reviewer is in this one.
    rsvps: { yes: ['review', 'diego', 'lucia', 'bianca'], no: [] },
  },
  {
    key: 'lake',
    groupKey: 'weekend',
    createdBy: 'alex',
    title: 'Sunday at the lake',
    description: 'Swimming, a long lunch, and nobody in a hurry.',
    location: 'Lago del Dique',
    plan_type: 'fixed',
    event_date: dateFromNow(-3, 11),
    min_people: 3,
    max_people: null,
    // A night that already happened, so the album has somewhere to live.
    rsvps: { yes: ['review', 'alex', 'bianca', 'diego'], no: [] },
  },
];

async function listAuthUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users || []));
    if (!data.users || data.users.length < 1000) break;
    page += 1;
  }

  return users;
}

async function ensureUsers() {
  const existing = new Map(
    (await listAuthUsers())
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user])
  );

  const byHandle = new Map();

  for (const person of people) {
    const metadata = { display_name: person.displayName, seed: 'review' };
    const found = existing.get(person.email.toLowerCase());

    const { data, error } = found
      ? await supabase.auth.admin.updateUserById(found.id, {
          password,
          user_metadata: metadata,
        })
      : await supabase.auth.admin.createUser({
          email: person.email,
          password,
          email_confirm: true,
          user_metadata: metadata,
        });

    if (error) throw error;
    byHandle.set(person.handle, { ...person, id: data.user.id });
  }

  return byHandle;
}

async function upsertProfiles(byHandle) {
  const rows = [...byHandle.values()].map((person) => ({
    id: person.id,
    email: person.email,
    display_name: person.displayName,
  }));

  const { error } = await supabase.from('profiles').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

async function upsertGroups(byHandle) {
  // groups.city_id is NOT NULL (PLA-88), and the column has no default on
  // purpose: a group's city is chosen, never inherited from whatever was
  // fashionable when the migration ran.
  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select('id, slug');
  if (citiesError) throw citiesError;
  const cityIdBySlug = new Map(cities.map((city) => [city.slug, city.id]));

  const rows = groups.map((group) => {
    const cityId = cityIdBySlug.get(group.citySlug);
    if (!cityId) throw new Error(`seed: no city seeded with slug "${group.citySlug}"`);

    return {
      name: group.name,
      description: group.description,
      invite_code: group.inviteCode,
      city_id: cityId,
      created_by: byHandle.get(group.admins[0]).id,
    };
  });

  const { data, error } = await supabase
    .from('groups')
    .upsert(rows, { onConflict: 'invite_code' })
    .select();

  if (error) throw error;

  return new Map(
    data.map((saved) => {
      const definition = groups.find((group) => group.inviteCode === saved.invite_code);
      return [definition.key, saved];
    })
  );
}

async function upsertMemberships(groupsByKey, byHandle) {
  const rows = [];

  for (const group of groups) {
    for (const handle of group.members) {
      rows.push({
        group_id: groupsByKey.get(group.key).id,
        user_id: byHandle.get(handle).id,
        role: group.admins.includes(handle) ? 'admin' : 'member',
      });
    }
  }

  const { error } = await supabase
    .from('group_members')
    .upsert(rows, { onConflict: 'group_id,user_id' });

  if (error) throw error;
}

/** Scoped to the two review groups, so a re-run rebuilds them and touches nothing else. */
async function deleteReviewPlans(groupsByKey) {
  const groupIds = [...groupsByKey.values()].map((group) => group.id);
  const { error } = await supabase.from('plans').delete().in('group_id', groupIds);
  if (error) throw error;
}

async function insertPlans(groupsByKey, byHandle) {
  const rows = plans.map((plan) => ({
    group_id: groupsByKey.get(plan.groupKey).id,
    created_by: byHandle.get(plan.createdBy).id,
    title: plan.title,
    description: plan.description,
    location: plan.location,
    plan_type: plan.plan_type,
    event_date: plan.plan_type === 'fixed' ? plan.event_date : null,
    min_people: plan.min_people,
    max_people: plan.max_people,
    status: 'open',
  }));

  const { data, error } = await supabase.from('plans').insert(rows).select();
  if (error) throw error;

  return new Map(
    data.map((saved) => {
      const definition = plans.find((plan) => plan.title === saved.title);
      return [definition.key, saved];
    })
  );
}

async function insertRsvps(plansByKey, byHandle) {
  const rows = [];

  for (const plan of plans.filter((item) => item.rsvps)) {
    for (const [response, handles] of Object.entries(plan.rsvps)) {
      for (const handle of handles) {
        rows.push({
          plan_id: plansByKey.get(plan.key).id,
          user_id: byHandle.get(handle).id,
          response,
        });
      }
    }
  }

  if (rows.length === 0) return;

  const { error } = await supabase.from('rsvps').insert(rows);
  if (error) throw error;
}

async function insertDateOptions(plansByKey, byHandle) {
  const flexible = plans.filter((plan) => plan.plan_type === 'flexible');
  if (flexible.length === 0) return;

  const optionRows = flexible.flatMap((plan) =>
    plan.dateOptions.map((date) => ({ plan_id: plansByKey.get(plan.key).id, date }))
  );

  const { data: options, error } = await supabase
    .from('plan_date_options')
    .insert(optionRows)
    .select();

  if (error) throw error;

  const availabilityRows = [];

  for (const plan of flexible) {
    const planId = plansByKey.get(plan.key).id;
    const ordered = options
      .filter((option) => option.plan_id === planId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const [handle, indexes] of Object.entries(plan.availability)) {
      for (const index of indexes) {
        availabilityRows.push({
          plan_id: planId,
          user_id: byHandle.get(handle).id,
          date_option_id: ordered[index].id,
          available: true,
        });
      }
    }
  }

  if (availabilityRows.length === 0) return;

  const { error: availabilityError } = await supabase
    .from('date_availability')
    .insert(availabilityRows);

  if (availabilityError) throw availabilityError;
}

async function main() {
  const byHandle = await ensureUsers();
  await upsertProfiles(byHandle);

  const groupsByKey = await upsertGroups(byHandle);
  await upsertMemberships(groupsByKey, byHandle);

  await deleteReviewPlans(groupsByKey);
  const plansByKey = await insertPlans(groupsByKey, byHandle);
  await insertRsvps(plansByKey, byHandle);
  await insertDateOptions(plansByKey, byHandle);

  console.log(`Seeded ${supabaseUrl}`);
  console.log(`  Review account: ${REVIEW_EMAIL}`);
  console.log(`  Groups:         ${groups.map((group) => group.name).join(', ')}`);
  console.log(`  Plans:          ${plans.length}`);
  console.log(`  Supporting accounts: ${people.length - 1}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
