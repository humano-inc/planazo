-- PLA-86: "a group needs at least one admin" was a client-side rule, and the
-- client cannot hold it.
--
-- PLA-50 settled the floor in the Admins screen: with one admin left, no
-- step-down control is rendered at all. That works for one person and fails for
-- two. A group with exactly two admins, both of whom open the screen and tap
-- "Step down", ends with zero admins: each client sees admins.length === 2 so
-- both show the control, and each write passes RLS because "Admins can update
-- memberships" checks is_group_admin(group_id) in USING with no WITH CHECK on
-- the resulting state. Both actors are still admins at write time. Nothing
-- repairs it afterwards, and a group with no admins is unmanageable: nobody can
-- edit it, remove anyone, approve a knock, or mint a new admin.
--
-- The invariant belongs here, so every surface that can shed an admin inherits
-- it rather than rediscovering it. Two verbs can shed one:
--
--   * UPDATE, demoting an admin to member. This is the reported bug, and the
--     Admins screen is the only thing that does it.
--   * DELETE, removing an admin's membership row. No client can reach this at
--     all: PLA-49 dropped "Members can leave or admins can kick" (20260807000000),
--     so a membership row goes one of four ways, and three of them already get
--     it right — leave_group and delete_my_account hand admin on first, and
--     remove_group_member refuses self-removal by name. The fourth is a
--     cascade, which promotes nobody and is exempted below for that reason.
--     The guard is for the next function to be written. RLS does not apply
--     inside a SECURITY DEFINER function and triggers do, so this is the only
--     place the floor can be stated once and inherited rather than remembered.
--
-- A CHECK constraint cannot count across rows and an RLS WITH CHECK cannot
-- either, would report as an opaque 42501, and is bypassed by every
-- SECURITY DEFINER function in this schema. A trigger is the only guard that
-- covers both verbs and every write path, the same reasoning enforce_plan_cap
-- wrote down in 20260731000001.
CREATE OR REPLACE FUNCTION public.enforce_last_admin_floor()
RETURNS TRIGGER AS $$
BEGIN
  -- Three exemptions, and all three are the same shape: the row on its way out
  -- is part of something larger that is already going. Each is checked by
  -- asking whether that larger thing is still there, because a cascade reaches
  -- this trigger only after its parent row is gone.

  -- 1. The group is going. group_members.group_id is ON DELETE CASCADE, so on
  -- a group delete this fires against a half-emptied members table with no
  -- group behind it. There is no floor to hold for a group that no longer
  -- exists, and refusing here would make deleting a group impossible.
  --
  -- The lock is the other half of this statement, and the whole fix for the
  -- race: two admins stepping down at once both read "the other one is still
  -- an admin" without it. The loser blocks here until the winner commits, then
  -- re-counts and finds itself alone. Locking the group row rather than the
  -- sibling membership rows is deliberate — both racers queue on one common
  -- resource, so the loser waits instead of deadlocking with the winner over
  -- each other's rows. FOR NO KEY UPDATE rather than FOR UPDATE because it
  -- excludes exactly what needs excluding (another run of this function) while
  -- still admitting the FOR KEY SHARE that Postgres takes on this row whenever
  -- anyone joins the group, posts a plan or sends an invite.
  PERFORM 1 FROM public.groups WHERE id = OLD.group_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 2. The person is going. Deleting an account cascades auth.users → profiles
  -- → group_members, and that path promotes nobody: delete_my_account hands
  -- each group to an heir before it gets here, but an operator deleting a
  -- reported user from the dashboard or through auth.admin.deleteUser does
  -- not. Without this, that delete fails with a PT422 raised three cascade
  -- levels down, and the account of a group's only admin becomes undeletable —
  -- which is precisely the account most likely to need deleting. Stranding the
  -- group is what happens today and is not this migration's to change; making
  -- the user unremovable would be.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.user_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 3. Nobody is left to strand. The last member walking out takes the group's
  -- last admin role with them by definition, and leave_group needs exactly this
  -- exemption: it deletes the final membership row and then the empty group.
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = OLD.group_id AND user_id <> OLD.user_id
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = OLD.group_id AND role = 'admin' AND user_id <> OLD.user_id
  ) THEN
    -- PostgREST's PTxyz convention: the SQLSTATE sets the HTTP status, so the
    -- app gets a typed 422 rather than a generic 500 it can only call
    -- "something broke". Not PT409, which already means "this plan is full" to
    -- isPlanFullError — one code, one meaning.
    RAISE EXCEPTION 'A group needs at least one admin'
      USING ERRCODE = 'PT422',
            DETAIL = format('group %s would be left with no admin', OLD.group_id),
            HINT = 'Make someone else an admin first.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- The WHEN clauses keep the function off every write that cannot break the
-- invariant: promotion adds an admin rather than removing one, and members
-- leaving are not admins. `OF role` goes further on the hot path — Postgres
-- does not so much as evaluate the WHEN unless `role` is in the SET list, so
-- set_group_notify's writes cost nothing at all here.
DROP TRIGGER IF EXISTS trg_last_admin_floor_update ON public.group_members;
CREATE TRIGGER trg_last_admin_floor_update
  BEFORE UPDATE OF role ON public.group_members
  FOR EACH ROW
  WHEN (OLD.role = 'admin' AND NEW.role IS DISTINCT FROM 'admin')
  EXECUTE FUNCTION public.enforce_last_admin_floor();

DROP TRIGGER IF EXISTS trg_last_admin_floor_delete ON public.group_members;
CREATE TRIGGER trg_last_admin_floor_delete
  BEFORE DELETE ON public.group_members
  FOR EACH ROW
  WHEN (OLD.role = 'admin')
  EXECUTE FUNCTION public.enforce_last_admin_floor();
