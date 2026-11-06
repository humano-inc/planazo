-- A plan can say when it ends (PLA-157).
--
-- A plan only knew when it started, so "past" had to be guessed: the client
-- called it at the end of the local day, and the server, knowing no timezone,
-- allowed a day of grace on top. A plan at 23:00 left the feed at midnight, and
-- a weekend away counted as over after one day.
--
-- The end is optional, and that is a product decision rather than a gap. Plenty
-- of plans have no honest answer, and because the end decides when a plan is
-- over, a default nobody chose would end them early. A fixed plan can set it
-- when it is created, a voted plan when the host locks the winning date, and a
-- plan without one behaves exactly as it did before this migration.

ALTER TABLE public.plans ADD COLUMN ends_at TIMESTAMPTZ;

-- The explicit IS NOT NULL matters. `ends_at > NULL` is NULL, which a CHECK
-- lets through, so without it an open vote with no date could hold an end.
ALTER TABLE public.plans ADD CONSTRAINT plans_ends_after_start CHECK (
  ends_at IS NULL
  OR (
    COALESCE(locked_date, event_date) IS NOT NULL
    AND ends_at > COALESCE(locked_date, event_date)
  )
);

-- Column grants do not extend to columns added later (20260802000002). The
-- start stays out of this list: it decides what a yes meant. The end does not
-- change when anyone shows up.
GRANT UPDATE (ends_at) ON public.plans TO authenticated;


-- Whether a plan is over ------------------------------------------------------
--
-- An end is an instant, so it needs no grace and answers the same in every
-- timezone, which is what puts this in step with the client's isPlanPast. A
-- plan with no end keeps the old test: the client calls it at the end of the
-- local day, and the server has no idea which zone that is. A plan with no date
-- at all, such as a vote nobody has locked, is not over.
CREATE OR REPLACE FUNCTION public.plan_is_over(p_start TIMESTAMPTZ, p_ends_at TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN p_ends_at IS NOT NULL THEN p_ends_at <= NOW()
    WHEN p_start IS NOT NULL THEN p_start < NOW() - INTERVAL '1 day'
    ELSE FALSE
  END;
$$ LANGUAGE sql STABLE SET search_path = public;

-- Only the SECURITY DEFINER functions below call this, and they run as its
-- owner.
REVOKE ALL ON FUNCTION public.plan_is_over(TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;


-- lock_plan: the host says when the winning date starts and ends --------------
--
-- A date option is only a day, stored at local midnight, so a locked vote used
-- to start at 00:00. The two new parameters default to NULL so an app that has
-- not updated keeps locking the way it did.
--
-- Dropped rather than replaced: CREATE OR REPLACE with a longer argument list
-- would add an overload, and a two-argument call would then match both.
DROP FUNCTION public.lock_plan(UUID, UUID);

CREATE OR REPLACE FUNCTION public.lock_plan(
  p_plan_id UUID,
  p_date_option_id UUID DEFAULT NULL,
  p_starts_at TIMESTAMPTZ DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_yes_count INTEGER;
  v_option RECORD;
  v_start TIMESTAMPTZ;
  v_notified INTEGER := 0;
  v_held INTEGER;
  v_limit INTEGER;
  v_base INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  IF NOT public.is_plan_host(v_plan.group_id, v_plan.created_by) THEN
    RAISE EXCEPTION 'Only the plan creator or a group admin can lock a plan';
  END IF;

  IF v_plan.status <> 'open' THEN
    RAISE EXCEPTION 'Plan is not open';
  END IF;

  IF v_plan.plan_type = 'fixed' THEN
    SELECT COUNT(*) INTO v_yes_count
    FROM public.rsvps
    WHERE plan_id = p_plan_id AND response = 'yes';

    IF v_yes_count < v_plan.min_people THEN
      RETURN jsonb_build_object('locked', false, 'reason', 'below_minimum');
    END IF;

    UPDATE public.plans
    SET status = 'locked', locked_at = NOW(), updated_at = NOW()
    WHERE id = p_plan_id;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT r.user_id, 'plan_locked', 'Plan Confirmed!',
           format('"%s" is happening!', v_plan.title),
           jsonb_build_object('plan_id', p_plan_id, 'group_id', v_plan.group_id)
    FROM public.rsvps r
    WHERE r.plan_id = p_plan_id AND r.response = 'yes'
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_users b
        WHERE b.blocker_id = v_plan.created_by
          AND b.blocked_id = r.user_id
      );
    GET DIAGNOSTICS v_notified = ROW_COUNT;

    RETURN jsonb_build_object('locked', true, 'notified', v_notified);
  END IF;

  SELECT o.id, o.date, COUNT(da.id) AS cnt
  INTO v_option
  FROM public.plan_date_options o
  LEFT JOIN public.date_availability da
    ON da.date_option_id = o.id AND da.available
  WHERE o.plan_id = p_plan_id
    AND (p_date_option_id IS NULL OR o.id = p_date_option_id)
  GROUP BY o.id, o.date
  HAVING COUNT(da.id) >= v_plan.min_people
  ORDER BY COUNT(da.id) DESC, o.date ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('locked', false, 'reason', 'no_viable_date');
  END IF;

  -- The time is the host's to choose and the day is not: the vote decided that.
  -- The window is this wide because the option's midnight belongs to whoever
  -- created the plan, and the host locking it may be in another timezone.
  IF p_starts_at IS NOT NULL AND p_starts_at NOT BETWEEN
    v_option.date - INTERVAL '1 day' AND v_option.date + INTERVAL '2 days'
  THEN
    RAISE EXCEPTION 'That time is not on the chosen date';
  END IF;

  v_start := COALESCE(p_starts_at, v_option.date);

  -- plans_ends_after_start refuses an end that is not after this start.
  UPDATE public.plans
  SET status = 'locked',
      locked_date = v_start,
      ends_at = p_ends_at,
      locked_at = NOW(),
      updated_at = NOW()
  WHERE id = p_plan_id;

  -- EVERY existing yes is a seat already spent, whether or not that person is
  -- free on the date being locked.
  --
  -- Discounting only the unavailable holders is not enough, and this is the
  -- re-lock bug: reopen_plan leaves the yes rows in place, so locking again
  -- onto a different date meets holders who ARE available but sort outside
  -- the new top-N. They hold a seat nobody counted, the newcomer chosen in
  -- their place trips the trigger, and the exception rolls back the lock the
  -- host just asked for, leaving the plan open with no explanation.
  SELECT COUNT(*) INTO v_held
  FROM public.rsvps
  WHERE plan_id = p_plan_id AND response = 'yes';

  -- NULL is "No limit", so an uncapped plan seats everyone and waitlists
  -- nobody, exactly as it did before this migration.
  v_limit := CASE
    WHEN v_plan.max_people IS NULL THEN NULL
    ELSE GREATEST(v_plan.max_people - v_held, 0)
  END;

  -- Where this lock's queue numbers start. Normally zero. Non-zero only on a
  -- re-lock of a plan that already had people waiting, whose places are kept.
  SELECT COALESCE(MAX(waitlist_seq), 0) INTO v_base
  FROM public.rsvps
  WHERE plan_id = p_plan_id AND response = 'pending';

  -- Availability on the locked date becomes attendance up to whatever the cap
  -- has left, and a place in the queue after that. Anyone already holding a
  -- yes is excluded rather than re-seated: they are counted in v_held, their
  -- row already says yes, and re-inserting them would only re-notify them on
  -- every re-lock. Anyone the plan's creator has blocked no longer attends
  -- the creator's plans, so they are seated in neither list; dissolution
  -- normally removed their availability already, and this closes the race
  -- where a block lands between the vote and the lock.
  --
  -- rn ranks the whole field once, in the same first-come order the cap
  -- doctrine has used since 20260731000001, and the two sets read off it. So
  -- seating and queueing cannot disagree about who was ahead of whom, and the
  -- queue is the continuation of the seating rather than a second opinion.
  --
  -- Every data-modifying CTE runs exactly once and to completion whether or
  -- not the primary query reads it, which is why waiting_rsvps needs no
  -- consumer.
  WITH ranked AS (
    SELECT da.user_id,
           row_number() OVER (ORDER BY da.created_at ASC, da.user_id ASC) AS rn
    FROM public.date_availability da
    WHERE da.date_option_id = v_option.id
      AND da.available
      AND NOT EXISTS (
        SELECT 1 FROM public.rsvps r
        WHERE r.plan_id = p_plan_id
          AND r.user_id = da.user_id
          AND r.response = 'yes'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_users b
        WHERE b.blocker_id = v_plan.created_by
          AND b.blocked_id = da.user_id
      )
  ),
  seated AS (
    SELECT user_id, rn FROM ranked
    WHERE v_limit IS NULL OR rn <= v_limit
  ),
  waiting AS (
    SELECT user_id, rn FROM ranked
    WHERE v_limit IS NOT NULL AND rn > v_limit
  ),
  seated_rsvps AS (
    INSERT INTO public.rsvps (plan_id, user_id, response)
    SELECT p_plan_id, s.user_id, 'yes' FROM seated s
    ON CONFLICT (plan_id, user_id) DO UPDATE SET response = 'yes'
    RETURNING user_id
  ),
  waiting_rsvps AS (
    INSERT INTO public.rsvps (plan_id, user_id, response, waitlist_seq)
    SELECT p_plan_id, w.user_id, 'pending', v_base + w.rn FROM waiting w
    -- COALESCE, not EXCLUDED: somebody already waiting keeps the place they
    -- have. A re-lock re-decides who is in, never who has been waiting longer.
    ON CONFLICT (plan_id, user_id) DO UPDATE
      SET response = 'pending',
          waitlist_seq = COALESCE(public.rsvps.waitlist_seq, EXCLUDED.waitlist_seq)
    RETURNING user_id
  )
  -- Only the people who actually got a seat are told the plan is happening.
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT s.user_id, 'plan_locked', 'Plan Confirmed!',
         format('"%s" is happening on %s!', v_plan.title, to_char(v_option.date, 'FMDay DD Mon')),
         jsonb_build_object('plan_id', p_plan_id, 'group_id', v_plan.group_id)
  FROM seated s;
  GET DIAGNOSTICS v_notified = ROW_COUNT;

  RETURN jsonb_build_object(
    'locked', true,
    'locked_date', v_start,
    'notified', v_notified
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- A new function takes the schema's default privileges, which include anon.
REVOKE ALL ON FUNCTION public.lock_plan(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_plan(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated, service_role;


-- reopen_plan: the end belongs to the date being unlocked ---------------------
CREATE OR REPLACE FUNCTION public.reopen_plan(p_plan_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan public.plans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  IF NOT public.is_plan_host(v_plan.group_id, v_plan.created_by) THEN
    RAISE EXCEPTION 'Only the plan creator or a group admin can reopen a plan';
  END IF;

  IF v_plan.status <> 'locked' THEN
    RAISE EXCEPTION 'Plan is not locked';
  END IF;
  IF v_plan.plan_type <> 'flexible' THEN
    RAISE EXCEPTION 'Only flexible plans can reopen the vote';
  END IF;

  UPDATE public.plans
  SET status = 'open', locked_date = NULL, ends_at = NULL, locked_at = NULL, updated_at = NOW()
  WHERE id = p_plan_id;

  RETURN jsonb_build_object('reopened', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- The three tests of whether a plan is over ----------------------------------
CREATE OR REPLACE FUNCTION public.restore_plan(p_plan_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_date TIMESTAMPTZ;
  v_status TEXT;
  v_notified INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  IF NOT public.is_plan_host(v_plan.group_id, v_plan.created_by) THEN
    RAISE EXCEPTION 'Only the plan creator or a group admin can restore a plan';
  END IF;

  IF v_plan.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Plan is not cancelled';
  END IF;

  SELECT COALESCE(v_plan.locked_date, v_plan.event_date, MAX(o.date))
  INTO v_date
  FROM public.plan_date_options o
  WHERE o.plan_id = p_plan_id;

  IF public.plan_is_over(v_date, v_plan.ends_at) THEN
    RAISE EXCEPTION 'The date has passed';
  END IF;

  -- A flexible plan that had locked a date goes back to locked; everything
  -- else (fixed plans, open votes) returns to open.
  v_status := CASE
    WHEN v_plan.plan_type = 'flexible' AND v_plan.locked_at IS NOT NULL THEN 'locked'
    ELSE 'open'
  END;

  UPDATE public.plans
  SET status = v_status,
      cancelled_at = NULL,
      cancelled_by = NULL,
      cancel_reason = NULL,
      updated_at = NOW()
  WHERE id = p_plan_id;

  -- The waiting test is an EXISTS rather than a column on the union, because
  -- the union deduplicates on the whole row: a flag that differed between the
  -- two branches would give the same person two notifications.
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT DISTINCT u.user_id, 'plan_reopened', 'Back on',
         CASE
           WHEN EXISTS (
             SELECT 1 FROM public.rsvps r2
             WHERE r2.plan_id = p_plan_id
               AND r2.user_id = u.user_id
               AND r2.response = 'pending'
           ) THEN
             format('"%s" is back on. You''re still on the waiting list.', v_plan.title)
           WHEN v_status = 'locked' OR v_plan.plan_type = 'fixed' THEN
             format('"%s" is back on. You''re still counted in.', v_plan.title)
           ELSE
             format('"%s" is back on. Your dates still stand.', v_plan.title)
         END,
         jsonb_build_object('plan_id', p_plan_id, 'group_id', v_plan.group_id)
  FROM (
    SELECT r.user_id FROM public.rsvps r
    WHERE r.plan_id = p_plan_id AND r.response IN ('yes', 'pending')
    UNION
    SELECT da.user_id FROM public.date_availability da
    WHERE da.plan_id = p_plan_id AND da.available
  ) u
  WHERE u.user_id <> v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE b.blocker_id = v_plan.created_by
        AND b.blocked_id = u.user_id
    );
  GET DIAGNOSTICS v_notified = ROW_COUNT;

  RETURN jsonb_build_object('restored', true, 'status', v_status, 'notified', v_notified);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION public.promote_from_waitlist()
RETURNS TRIGGER AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_taken INTEGER;
  v_next public.rsvps%ROWTYPE;
BEGIN
  -- Only a released seat frees room. This is also what stops the recursion:
  -- the promotion below is an UPDATE on rsvps, and its OLD row is the pending
  -- one, so it falls out here rather than promoting again.
  IF OLD.response IS DISTINCT FROM 'yes' THEN
    RETURN NULL;
  END IF;

  -- NEW is unassigned on a DELETE, so this cannot be folded into the test
  -- above.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.response = 'yes' THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Cancelled plans promote nobody, and neither does a plan being deleted: the
  -- rows cascade out from under us and there is no plan row left to lock.
  SELECT * INTO v_plan
  FROM public.plans
  WHERE id = OLD.plan_id AND status IN ('open', 'locked')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- NULL cap is "No limit", so there was never a queue to promote from.
  IF v_plan.max_people IS NULL THEN
    RETURN NULL;
  END IF;

  -- A plan that is over promotes nobody.
  IF public.plan_is_over(COALESCE(v_plan.locked_date, v_plan.event_date), v_plan.ends_at) THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_taken
  FROM public.rsvps
  WHERE plan_id = OLD.plan_id AND response = 'yes';

  IF v_taken >= v_plan.max_people THEN
    RETURN NULL;
  END IF;

  SELECT r.* INTO v_next
  FROM public.rsvps r
  WHERE r.plan_id = OLD.plan_id AND r.response = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE b.blocker_id = v_plan.created_by
        AND b.blocked_id = r.user_id
    )
  ORDER BY r.waitlist_seq ASC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- assign_waitlist_seq clears the number on the way through; enforce_plan_cap
  -- re-checks the cap under the lock this function already holds.
  UPDATE public.rsvps
  SET response = 'yes', updated_at = NOW()
  WHERE id = v_next.id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_next.user_id, 'plan_promoted', 'You''re in',
    format('A place opened up on "%s". You''re in.', v_plan.title),
    jsonb_build_object('plan_id', v_plan.id, 'group_id', v_plan.group_id)
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION public.dissolve_block_ties(p_blocker UUID, p_blocked UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Gathered once so both participation DELETEs share a single definition of
  -- "live" and a single scan of plans. A flexible plan nobody has locked yet
  -- has no start at all, which plan_is_over counts as not over.
  v_live_plan_ids UUID[] := ARRAY(
    SELECT p.id FROM public.plans p
    WHERE p.created_by = p_blocker
      AND p.status IN ('open', 'locked')
      AND NOT public.plan_is_over(COALESCE(p.locked_date, p.event_date), p.ends_at)
  );
BEGIN
  DELETE FROM public.friendships
  WHERE (requester_id = p_blocker AND addressee_id = p_blocked)
     OR (requester_id = p_blocked AND addressee_id = p_blocker);

  DELETE FROM public.group_invites
  WHERE status = 'pending'
    AND ((invited_by = p_blocker AND invitee_id = p_blocked)
      OR (invited_by = p_blocked AND invitee_id = p_blocker));

  DELETE FROM public.rsvps
  WHERE user_id = p_blocked AND plan_id = ANY(v_live_plan_ids);

  DELETE FROM public.date_availability
  WHERE user_id = p_blocked AND plan_id = ANY(v_live_plan_ids);
END;
$$;
