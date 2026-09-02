-- PLA-139: a plan can be posted to all your friends, or to friends of friends,
-- instead of to a group.
--
-- Until now a plan belonged to a group and a group's membership was the
-- whole answer to "who can see this": one is_group_member(group_id) test,
-- repeated in every policy that touches a plan or one of its satellites. An
-- audience column on plans replaces that one test with one function,
-- can_view_plan, and every policy that used to ask about the group asks it
-- instead. The audiences:
--
--   group              a group's members, exactly as before
--   friends            everyone with an accepted friendship to the creator
--   friends_of_friends the same, plus anyone who shares an accepted friend
--                      with the creator
--
-- Seeing a plan is the invite. The rsvp and availability write policies test
-- plan visibility through their plans subqueries, so whoever the audience
-- admits can answer, and nothing about joining changes here.
--
-- The shield rule (PLA-44) holds on every path: NOT is_blocked_by(created_by)
-- stays inside can_view_plan, and a friend-of-friends bridge does not carry
-- sight when the bridge has blocked the viewer. B blocking C erases B from C's
-- world, and that includes B being the mutual friend through which C would
-- reach A's plan. If no unblocked bridge remains, C does not see the plan.
--
-- Once you hold a seat you keep sight of the plan: an attendee who is later
-- unfriended (or whose bridge unfriends the creator) is still on the list, and
-- a plan you are on that you cannot open is a worse bug than one you can. A
-- block is the only thing that pulls someone out, and dissolve_block_ties
-- keys on the creator, so it already covers group-less plans.
--
-- The friendships table is readable by its two parties only, so none of this
-- can be a plain policy expression or a client query: is_friend,
-- is_friend_of_friend and can_view_plan are SECURITY DEFINER for the same
-- reason is_group_member is. friend_ids, the set they share, is executable by
-- nobody but them.
--
-- A group-less plan has no admins, so its host is its creator alone. Every
-- host path (lock, cancel, restore, reopen, the edit policy, the poll writes)
-- already funnels through is_plan_host, so that is the one function that
-- learns about it.
--
-- Merged migrations are immutable, so each function below is re-emitted whole
-- from wherever its latest definition lives: can_view_plan_photos,
-- can_add_plan_photo, notify_plan_created from 20260804000002;
-- can_vote_plan_poll, notify_plan_poll_opened from 20260804000003;
-- is_plan_host from 20260803000000. CREATE OR REPLACE keeps each one's ACL.
-- The only edits are the audience branches, except in notify_plan_poll_opened,
-- whose block predicate still ran in the pre-shield direction (skipping
-- recipients who had blocked the author) and now matches every other fan-out.


-- 1. The column -----------------------------------------------------------------

ALTER TABLE public.plans ALTER COLUMN group_id DROP NOT NULL;

ALTER TABLE public.plans
  ADD COLUMN audience TEXT NOT NULL DEFAULT 'group'
  CHECK (audience IN ('group', 'friends', 'friends_of_friends'));

-- A group plan has a group and nothing else does. Both halves, so a row can
-- neither claim a group it does not name nor name one it says it is not for.
ALTER TABLE public.plans
  ADD CONSTRAINT plans_audience_matches_group
  CHECK ((audience = 'group') = (group_id IS NOT NULL));

-- SELECT and INSERT on plans are table-level grants, so the new column rides
-- along. UPDATE is column-listed (title, location, description) and audience
-- is deliberately not on it: where a plan went is settled when it is posted.


-- 2. Who is a friend ---------------------------------------------------------------

-- Every accepted friend of one person, either direction of the row. Private:
-- a friend set handed to the client would be the friendships SELECT policy
-- undone, so only the definer functions below may call it.
CREATE OR REPLACE FUNCTION public.friend_ids(p_user UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN f.requester_id = p_user THEN f.addressee_id ELSE f.requester_id END
  FROM public.friendships f
  WHERE f.status = 'accepted'
    AND (f.requester_id = p_user OR f.addressee_id = p_user);
$$;

REVOKE ALL ON FUNCTION public.friend_ids(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_friend(p_other UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_other IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = p_other)
          OR (f.requester_id = p_other AND f.addressee_id = auth.uid()))
    );
$$;

REVOKE ALL ON FUNCTION public.is_friend(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_friend(UUID) TO authenticated;

-- Two hops: someone who is an accepted friend of both me and p_other, and who
-- has not blocked me. A direct friend is not a friend of a friend by this
-- test (they may well also be, through a third person); callers that mean
-- "within two hops" ask is_friend as well.
CREATE OR REPLACE FUNCTION public.is_friend_of_friend(p_other UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_other IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.friend_ids(auth.uid()) AS mine(bridge)
      WHERE mine.bridge IN (SELECT public.friend_ids(p_other))
        AND NOT EXISTS (
          SELECT 1 FROM public.blocked_users b
          WHERE b.blocker_id = mine.bridge AND b.blocked_id = auth.uid()
        )
    );
$$;

REVOKE ALL ON FUNCTION public.is_friend_of_friend(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_friend_of_friend(UUID) TO authenticated;


-- 3. Who can see a plan ------------------------------------------------------------

-- Two arities. The plans policy itself hands over the row's own columns, so
-- the check never re-reads the table it is guarding; everything that hangs
-- off a plan (rsvps, dates, polls, photos) has only the id and takes the
-- lookup.
CREATE OR REPLACE FUNCTION public.can_view_plan(
  p_plan_id UUID,
  p_audience TEXT,
  p_group_id UUID,
  p_created_by UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.is_blocked_by(p_created_by)
    AND (
      CASE p_audience
        WHEN 'group' THEN public.is_group_member(p_group_id)
        WHEN 'friends' THEN
          p_created_by = auth.uid()
          OR public.is_friend(p_created_by)
        WHEN 'friends_of_friends' THEN
          p_created_by = auth.uid()
          OR public.is_friend(p_created_by)
          OR public.is_friend_of_friend(p_created_by)
        ELSE FALSE
      END
      -- A seat keeps its sight (see the header). Group plans do not need
      -- this: leaving the group already deletes the rows.
      OR (
        p_audience <> 'group'
        AND (
          EXISTS (
            SELECT 1 FROM public.rsvps r
            WHERE r.plan_id = p_plan_id AND r.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.date_availability da
            WHERE da.plan_id = p_plan_id AND da.user_id = auth.uid()
          )
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_plan(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = p_plan_id
      AND public.can_view_plan(p.id, p.audience, p.group_id, p.created_by)
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_plan(UUID, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_plan(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_plan(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_plan(UUID) TO authenticated;


-- 4. The plan itself -----------------------------------------------------------------

DROP POLICY IF EXISTS "Group members can view plans" ON public.plans;
CREATE POLICY "Audience can view plans"
  ON public.plans FOR SELECT
  TO authenticated
  USING (public.can_view_plan(id, audience, group_id, created_by));

-- A group plan still needs the group's permission (admin, or member where
-- anyone_can_post). A friends plan needs only its author.
DROP POLICY IF EXISTS "Group members can create plans" ON public.plans;
CREATE POLICY "Group members can create plans"
  ON public.plans FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (audience <> 'group' AND group_id IS NULL)
      OR public.is_group_admin(group_id)
      OR (
        public.is_group_member(group_id)
        AND (SELECT g.anyone_can_post FROM public.groups g WHERE g.id = group_id)
      )
    )
  );

-- The host of a plan with no group is whoever posted it.
CREATE OR REPLACE FUNCTION public.is_plan_host(p_group_id UUID, p_created_by UUID)
RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN p_group_id IS NULL THEN
      auth.uid() IS NOT NULL AND auth.uid() = p_created_by
    ELSE EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = p_group_id
        AND gm.user_id = auth.uid()
        AND (gm.role = 'admin' OR gm.user_id = p_created_by)
    )
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;


-- 5. Everything that hangs off a plan ---------------------------------------------

DROP POLICY IF EXISTS "Group members can view date options" ON public.plan_date_options;
CREATE POLICY "Plan viewers can view date options"
  ON public.plan_date_options FOR SELECT
  TO authenticated
  USING (public.can_view_plan(plan_id));

DROP POLICY IF EXISTS "Plan creators can insert date options" ON public.plan_date_options;
CREATE POLICY "Plan creators can insert date options"
  ON public.plan_date_options FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_date_options.plan_id
        AND p.created_by = auth.uid()
        AND public.can_view_plan(p.id, p.audience, p.group_id, p.created_by)
    )
  );

DROP POLICY IF EXISTS "Group members can view RSVPs" ON public.rsvps;
CREATE POLICY "Plan viewers can view RSVPs"
  ON public.rsvps FOR SELECT
  TO authenticated
  USING (public.can_view_plan(plan_id));

DROP POLICY IF EXISTS "Group members can view availability" ON public.date_availability;
CREATE POLICY "Plan viewers can view availability"
  ON public.date_availability FOR SELECT
  TO authenticated
  USING (public.can_view_plan(plan_id));

DROP POLICY IF EXISTS "Group members can view plan polls" ON public.plan_polls;
CREATE POLICY "Plan viewers can view plan polls"
  ON public.plan_polls FOR SELECT
  TO authenticated
  USING (public.can_view_plan(plan_id));

DROP POLICY IF EXISTS "Group members can view poll options" ON public.plan_poll_options;
CREATE POLICY "Plan viewers can view poll options"
  ON public.plan_poll_options FOR SELECT
  TO authenticated
  USING (public.can_view_plan(plan_id));

DROP POLICY IF EXISTS "Group members can view poll votes" ON public.plan_poll_votes;
CREATE POLICY "Plan viewers can view poll votes"
  ON public.plan_poll_votes FOR SELECT
  TO authenticated
  USING (public.can_view_plan(plan_id));

CREATE OR REPLACE FUNCTION public.can_view_plan_photos(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_view_plan(p_plan_id);
$$;

CREATE OR REPLACE FUNCTION public.can_add_plan_photo(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = p_plan_id
      AND p.status <> 'cancelled'
      -- The album opens when the night does, and never closes again (see
      -- 20260804000002 for the reasoning behind both halves).
      AND COALESCE(p.locked_date, p.event_date) <= NOW()
      AND public.can_view_plan(p.id, p.audience, p.group_id, p.created_by)
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.rsvps r
          WHERE r.plan_id = p.id
            AND r.user_id = auth.uid()
            AND r.response = 'yes'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_vote_plan_poll(p_poll_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plan_polls pp
    JOIN public.plans p ON p.id = pp.plan_id
    WHERE pp.id = p_poll_id
      AND p.status <> 'cancelled'
      AND public.can_view_plan(p.id, p.audience, p.group_id, p.created_by)
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.rsvps r
          WHERE r.plan_id = p.id
            AND r.user_id = auth.uid()
            AND r.response = 'yes'
        )
        OR EXISTS (
          SELECT 1 FROM public.date_availability da
          WHERE da.plan_id = p.id
            AND da.user_id = auth.uid()
            AND da.available
        )
      )
  );
$$;


-- 6. The fan-outs ---------------------------------------------------------------------

-- Who hears about a new plan, by audience. A group plan pings its members
-- who asked to hear about new plans. A friends plan pings the creator's
-- friends. A friends-of-friends plan pings the creator's friends and stops
-- there: a push to someone who never chose any connection to you is a
-- different product from "your network sees your plans", and the second hop
-- finds it in the feed. The block predicate is the shield's direction: the
-- creator's blocks silence the creator, nobody else's do.
CREATE OR REPLACE FUNCTION public.plan_audience_recipients(
  p_audience TEXT,
  p_group_id UUID,
  p_created_by UUID
)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gm.user_id
  FROM public.group_members gm
  WHERE p_audience = 'group'
    AND gm.group_id = p_group_id
    AND gm.notify_new_plans
  UNION
  SELECT f
  FROM public.friend_ids(p_created_by) AS f
  WHERE p_audience IN ('friends', 'friends_of_friends');
$$;

REVOKE ALL ON FUNCTION public.plan_audience_recipients(TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_plan_created()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT display_name INTO v_name FROM public.profiles WHERE id = NEW.created_by;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT r.user_id, 'plan_created', 'New plan',
         CASE
           WHEN NEW.plan_type = 'fixed' THEN
             format('%s put up "%s". Are you in?', v_name, NEW.title)
           ELSE
             format('%s put up "%s". Pick the dates that work.', v_name, NEW.title)
         END,
         jsonb_build_object('plan_id', NEW.id, 'group_id', NEW.group_id)
  FROM public.plan_audience_recipients(NEW.audience, NEW.group_id, NEW.created_by) AS r(user_id)
  WHERE r.user_id <> NEW.created_by
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE b.blocker_id = NEW.created_by
        AND b.blocked_id = r.user_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notify_plan_poll_opened()
RETURNS TRIGGER AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_author UUID;
  v_name TEXT;
BEGIN
  SELECT * INTO v_plan FROM public.plans WHERE id = NEW.plan_id;

  -- A poll written in the create sheet rides along with the plan_created
  -- push (see 20260804000003); only a question added later announces itself.
  IF NOW() - v_plan.created_at < INTERVAL '5 minutes' THEN
    RETURN NEW;
  END IF;

  -- auth.uid() is the person who inserted the poll; a service-role insert
  -- (seeds, tooling) has none, and the host is the honest fallback.
  v_author := COALESCE(auth.uid(), v_plan.created_by);
  SELECT display_name INTO v_name FROM public.profiles WHERE id = v_author;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT r.user_id, 'poll_opened', 'New question',
         format('%s wants to know: %s', COALESCE(v_name, 'The host'), NEW.question),
         jsonb_build_object(
           'plan_id', NEW.plan_id,
           'group_id', v_plan.group_id,
           'poll_id', NEW.id
         )
  FROM public.plan_audience_recipients(v_plan.audience, v_plan.group_id, v_plan.created_by)
    AS r(user_id)
  WHERE r.user_id <> v_author
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE b.blocker_id = v_author AND b.blocked_id = r.user_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
