// PLA-88: a group belongs to a city.
//
// Four claims, none of them visible from a mocked client:
//
//   1. `cities` is reference data every signed-in person can read and nobody
//      can write. The absence of write policies is the write protection, so
//      the absence has to be tested.
//   2. `groups.city_id` is NOT NULL, and the migration backfilled the rows
//      that existed before the column did rather than leaving them behind.
//   3. `create_group` will not make a group without a city.
//   4. Moving a group is an admin's write. The screens hide the row from a
//      member, but the policy is what actually refuses them.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestBed, TestUser, ok } from './testbed';

const bed = new TestBed();

let owner: TestUser; // an admin, who can move the group
let member: TestUser; // a plain member, who cannot
let elsewhere: string; // a city id that is not the group's

beforeAll(async () => {
  [owner, member] = await Promise.all([bed.createUser(), bed.createUser()]);
  // Anywhere that is not the bed's default, so "moved" is distinguishable.
  const row = ok(
    await owner.client.from('cities').select('id').eq('slug', 'cordoba').single(),
  );
  elsewhere = row.id;
}, 60_000);

afterAll(async () => {
  await bed.dispose();
}, 60_000);

describe('the cities table', () => {
  it('is readable by anyone signed in, capitals and all', async () => {
    const rows = ok(await member.client.from('cities').select('slug, name, timezone'));

    expect(rows.length).toBeGreaterThan(20);
    // The backfill target and the launch city, by name rather than by count:
    // a later seed migration should be free to add cities without failing this.
    expect(rows).toContainEqual({
      slug: 'mendoza',
      name: 'Mendoza',
      timezone: 'America/Argentina/Mendoza',
    });
    expect(rows.map((c) => c.slug)).toContain('buenos-aires');
  });

  it('carries coordinates and an IANA zone on every row, which the idea engine needs', async () => {
    const rows = ok(await member.client.from('cities').select('slug, lat, lon, timezone'));

    const broken = rows.filter(
      (c) =>
        typeof c.lat !== 'number' ||
        typeof c.lon !== 'number' ||
        !c.timezone.startsWith('America/Argentina/'),
    );
    expect(broken).toEqual([]);
  });

  it('refuses a write from an ordinary signed-in client', async () => {
    const denied = await owner.client.from('cities').insert({
      slug: 'atlantis',
      name: 'Atlantis',
      country_code: 'AR',
      lat: 0,
      lon: 0,
      timezone: 'America/Argentina/Buenos_Aires',
    });
    expect(denied.error?.message).toMatch(/row-level security/);

    const renamed = await owner.client
      .from('cities')
      .update({ name: 'Mendocity' })
      .eq('slug', 'mendoza');
    // No UPDATE policy means no rows are visible to update: PostgREST reports
    // success over an empty set rather than an error, so the row is the proof.
    expect(renamed.error).toBeNull();
    const still = ok(
      await owner.client.from('cities').select('name').eq('slug', 'mendoza').single(),
    );
    expect(still.name).toBe('Mendoza');
  });
});

describe('every group has a city', () => {
  it('leaves no group without one, including the ones that predate the column', async () => {
    const orphans = ok(await bed.service.from('groups').select('id').is('city_id', null));
    expect(orphans).toEqual([]);
  });

  it('create_group refuses to make one without a city', async () => {
    const denied = await owner.client.rpc('create_group', {
      p_name: 'Cityless',
      p_city_id: null as unknown as string,
    });
    expect(denied.error).toBeTruthy();
  });

  it('create_group stores the city it was given', async () => {
    const group = await bed.createGroup(owner, { name: 'City Stored', city_id: elsewhere });
    expect(group.city_id).toBe(elsewhere);
  });
});

describe('moving a group', () => {
  it('an admin can, and a member cannot', async () => {
    const group = await bed.createGroup(owner, { name: 'Movers' });
    await bed.join(group.id, member);
    const home = group.city_id;

    // RLS filters the UPDATE to rows the member can write, which is none of
    // them, so this succeeds over an empty set. The row is what says no.
    const refused = await member.client
      .from('groups')
      .update({ city_id: elsewhere })
      .eq('id', group.id);
    expect(refused.error).toBeNull();
    const afterMember = ok(
      await member.client.from('groups').select('city_id').eq('id', group.id).single(),
    );
    expect(afterMember.city_id).toBe(home);

    ok(await owner.client.from('groups').update({ city_id: elsewhere }).eq('id', group.id));
    const afterAdmin = ok(
      await member.client.from('groups').select('city_id').eq('id', group.id).single(),
    );
    expect(afterAdmin.city_id).toBe(elsewhere);
  });

  it('will not point a group at a city that does not exist', async () => {
    const group = await bed.createGroup(owner, { name: 'Nowhere' });
    const denied = await owner.client
      .from('groups')
      .update({ city_id: '00000000-0000-4000-8000-000000000000' })
      .eq('id', group.id);
    expect(denied.error?.message).toMatch(/foreign key/i);
  });
});
