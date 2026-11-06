// PLA-156: a plan's place can point at a real one. `location_place_id` is a new
// column on a table whose UPDATE grant lists its columns, so what needs checking
// is that the host can actually write it, and nobody else can.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TestBed, TestUser, ok, daysFromNow } from './testbed';

const bed = new TestBed();

let host: TestUser;
let member: TestUser;
let groupId: string;
const planIds: string[] = [];

const insertPlan = (user: TestUser, fields: Record<string, unknown>) =>
  user.client
    .from('plans')
    .insert({
      group_id: groupId,
      created_by: user.id,
      title: `it-place-${randomUUID().slice(0, 8)}`,
      plan_type: 'fixed',
      event_date: daysFromNow(7),
      min_people: 2,
      ...fields,
    })
    .select('id, location, location_place_id')
    .single();

async function createPlan(fields: Record<string, unknown> = {}) {
  const plan = ok(await insertPlan(host, { location: 'Arena', ...fields }));
  planIds.push(plan.id);
  return plan;
}

const readPlan = async (id: string) =>
  ok(await host.client.from('plans').select('location, location_place_id').eq('id', id).single());

beforeAll(async () => {
  [host, member] = await Promise.all([bed.createUser('Place Host'), bed.createUser('Place Member')]);
  groupId = (await bed.createGroup(host)).id;
  await bed.join(groupId, member);
});

afterAll(async () => {
  await bed.service.from('plans').delete().in('id', planIds);
  await bed.dispose();
});

describe('plans.location_place_id', () => {
  it('is empty on a free-text plan', async () => {
    const plan = await createPlan({ location: 'casa de Juan' });
    expect(plan.location_place_id).toBeNull();
  });

  it('can be set when the plan is created', async () => {
    const plan = await createPlan({ location_place_id: 'ChIJ_create' });
    expect(plan.location_place_id).toBe('ChIJ_create');
  });

  it('the host can set and clear it', async () => {
    const { id } = await createPlan();

    ok(await host.client.from('plans').update({ location_place_id: 'ChIJ_edit' }).eq('id', id).select('id'));
    expect((await readPlan(id)).location_place_id).toBe('ChIJ_edit');

    ok(await host.client.from('plans').update({ location_place_id: null }).eq('id', id).select('id'));
    expect((await readPlan(id)).location_place_id).toBeNull();
  });

  it('a member who is not the host changes nothing', async () => {
    const { id } = await createPlan({ location_place_id: 'ChIJ_host' });

    const rows = ok(
      await member.client.from('plans').update({ location_place_id: 'ChIJ_member' }).eq('id', id).select('id'),
    );

    expect(rows).toEqual([]);
    expect((await readPlan(id)).location_place_id).toBe('ChIJ_host');
  });

  it('refuses an id with no words to go with it', async () => {
    const { error } = await insertPlan(host, { location: null, location_place_id: 'ChIJ_alone' });
    expect(error?.message).toContain('plans_place_id_needs_location');
  });

  it('refuses to clear the words while an id is still set', async () => {
    const { id } = await createPlan({ location_place_id: 'ChIJ_keep' });

    const { error } = await host.client.from('plans').update({ location: null }).eq('id', id);

    expect(error?.message).toContain('plans_place_id_needs_location');
    expect((await readPlan(id)).location).toBe('Arena');
  });

  it('refuses a junk id', async () => {
    const { error } = await insertPlan(host, { location_place_id: 'x'.repeat(1025) });
    expect(error?.message).toContain('plans_place_id_length');
  });
});
