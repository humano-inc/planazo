-- PLA-152: anyone who can see a plan can comment on it.
--
-- "What time are we meeting?", "I'll bring the speaker", "running 10 minutes
-- late". Today that conversation leaves Planazo for a group chat. A plan gets
-- one flat list, oldest first, with no replies, reactions, editing or mentions.
--
-- Seeing a plan is enough to comment on it, whatever its audience, so on a
-- friends-of-friends plan people who do not know each other talk to each other,
-- the same way they already share an attendee list. The list opens when the
-- plan is posted and never closes. A cancelled plan keeps its comments readable
-- but takes no new ones.
--
-- A comment is what its author created, so the shield rule (PLA-44) treats it
-- exactly as it treats a photo: it vanishes for anyone the author has blocked,
-- and the blocker keeps seeing the blocked person's. The count a viewer sees is
-- the count of what they can read, because a real count would announce the
-- block. The "real count" invariant in 20260804000002 is about attendee lists.
--
-- The author cascades, like plan_photos.uploaded_by and unlike
-- plans.created_by: a comment is the author's own content, and delete_my_account
-- promises to take what is theirs.


-- 1. Who can see a plan, asked about someone other than the caller --------------
--
-- can_view_plan answers for auth.uid(), and a fan-out runs as whoever wrote the
-- comment, so it cannot ask about a recipient. The rule moves here whole with
-- the viewer as an argument, and can_view_plan becomes the form of it that fills
-- in the caller. Two bodies would drift, and the drift would be silent: a push
-- about a plan the database refuses to show is how a block gets announced.
--
-- Private, the way friend_ids is. Handed to a client it would answer "can this
-- other person see that plan?", which is the friendship and block graph that
-- their RLS exists to keep unreadable. The REVOKE has to name anon and
-- authenticated: since 20261104000000 the default privileges grant them EXECUTE
-- on every new function, and revoking from PUBLIC does not touch that.
CREATE OR REPLACE FUNCTION public.can_view_plan_as(
  p_viewer UUID,
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
  SELECT p_viewer IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE b.blocker_id = p_created_by AND b.blocked_id = p_viewer
    )
    AND (
      CASE p_audience
        WHEN 'group' THEN EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = p_group_id AND gm.user_id = p_viewer
        )
        WHEN 'friends' THEN
          p_created_by = p_viewer
          OR p_created_by IN (SELECT public.friend_ids(p_viewer))
        WHEN 'friends_of_friends' THEN
          p_created_by = p_viewer
          OR p_created_by IN (SELECT public.friend_ids(p_viewer))
          -- A bridge who has blocked the viewer does not carry sight
          -- (20260902000000).
          OR EXISTS (
            SELECT 1 FROM public.friend_ids(p_viewer) AS mine(bridge)
            WHERE mine.bridge IN (SELECT public.friend_ids(p_created_by))
              AND NOT EXISTS (
                SELECT 1 FROM public.blocked_users b
                WHERE b.blocker_id = mine.bridge AND b.blocked_id = p_viewer
              )
          )
        ELSE FALSE
      END
      -- A seat keeps its sight. Group plans do not need this: leaving the group
      -- already deletes the rows.
      OR (
        p_audience <> 'group'
        AND (
          EXISTS (
            SELECT 1 FROM public.rsvps r
            WHERE r.plan_id = p_plan_id AND r.user_id = p_viewer
          )
          OR EXISTS (
            SELECT 1 FROM public.date_availability da
            WHERE da.plan_id = p_plan_id AND da.user_id = p_viewer
          )
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_plan_as(UUID, UUID, TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;

-- CREATE OR REPLACE keeps the ACL 20260902000000 gave it.
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
  SELECT public.can_view_plan_as(auth.uid(), p_plan_id, p_audience, p_group_id, p_created_by);
$$;

-- can_view_plan was its only caller, and no client has ever called it.
DROP FUNCTION public.is_friend_of_friend(UUID);


-- 2. Who can add a comment ------------------------------------------------------

-- Seeing, plus the plan still being on. Reads the live status, so a plan that
-- is restored takes comments again. SECURITY DEFINER for the same reason
-- can_add_plan_photo is: called from a policy, it must not re-enter the RLS of
-- what it reads.
CREATE OR REPLACE FUNCTION public.can_comment_on_plan(p_plan_id UUID)
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
      AND public.can_view_plan(p.id, p.audience, p.group_id, p.created_by)
  );
$$;

REVOKE ALL ON FUNCTION public.can_comment_on_plan(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_comment_on_plan(UUID) TO authenticated;


-- 3. The rows -------------------------------------------------------------------

-- 1 to 500 characters once trimmed. The trim names its characters because a bare
-- btrim() strips spaces and nothing else, which would accept a comment of three
-- newlines. The set is what JavaScript's trim() strips, so a body the composer
-- would call blank is one the database calls blank too.
CREATE TABLE public.plan_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CONSTRAINT plan_comments_body_length CHECK (
    char_length(btrim(
      body,
      E' \t\n\r\f\u000B                 　﻿'
    )) BETWEEN 1 AND 500
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plan_comments_plan ON public.plan_comments(plan_id, created_at);
CREATE INDEX idx_plan_comments_author ON public.plan_comments(author_id);

ALTER TABLE public.plan_comments ENABLE ROW LEVEL SECURITY;

-- Stated rather than inherited (see 20261104000000), and narrower than the
-- default privileges would leave it. Nothing here is for a signed-out caller.
-- INSERT is column-listed so a client cannot backdate a comment into the middle
-- of the conversation, and leaving UPDATE off means an edit is refused outright
-- rather than quietly matching no rows.
REVOKE ALL ON TABLE public.plan_comments FROM anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.plan_comments TO authenticated;
GRANT INSERT (plan_id, author_id, body) ON TABLE public.plan_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.plan_comments TO service_role;

CREATE POLICY "Plan viewers can read comments"
  ON public.plan_comments FOR SELECT
  TO authenticated
  USING (
    public.can_view_plan(plan_id)
    AND NOT public.is_blocked_by(author_id)
  );

CREATE POLICY "Plan viewers can add comments"
  ON public.plan_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_comment_on_plan(plan_id)
  );

-- Author only. Handing the host a delete is a moderation power, and reporting
-- covers the case it would be used for, same as photos.
CREATE POLICY "Authors can delete their own comments"
  ON public.plan_comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());


-- 4. Reporting ------------------------------------------------------------------

ALTER TABLE public.content_reports
  DROP CONSTRAINT IF EXISTS content_reports_subject_type_check;

ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_subject_type_check
  CHECK (subject_type IN ('plan', 'group', 'profile', 'photo', 'comment'));


-- 5. The fan-out ----------------------------------------------------------------

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'plan_created', 'plan_locked', 'plan_cancelled', 'plan_reopened',
    'plan_promoted', 'invited_to_group', 'kicked_from_group',
    'poll_opened', 'join_requested', 'join_approved', 'plan_comment'
  ));

-- A new comment reaches the host, everyone going, and everyone who has already
-- commented, and never its author. Going is a yes; while a flexible plan's vote
-- is still running nobody has a yes to give, so it is anyone who marked a date
-- available.
--
-- Two filters on all of them. A recipient has to be able to see the plan when
-- the comment lands, which is what stops someone who left the group hearing
-- about it through a comment they wrote while they were in it. And the block
-- predicate is the shield's direction: the author's blocks silence the author,
-- and nobody else's do.
--
-- The push gets one line of the comment, however it was laid out. The whole
-- comment is one tap away, and the banner only has room for so much of it.
CREATE OR REPLACE FUNCTION public.notify_plan_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_name TEXT;
  v_preview TEXT;
BEGIN
  SELECT * INTO v_plan FROM public.plans WHERE id = NEW.plan_id;
  SELECT display_name INTO v_name FROM public.profiles WHERE id = NEW.author_id;

  v_preview := btrim(regexp_replace(NEW.body, '\s+', ' ', 'g'));
  IF char_length(v_preview) > 140 THEN
    v_preview := rtrim(left(v_preview, 139)) || '…';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT r.user_id, 'plan_comment', v_plan.title,
         format('%s: %s', v_name, v_preview),
         jsonb_build_object(
           'plan_id', NEW.plan_id,
           'group_id', v_plan.group_id,
           'comment_id', NEW.id
         )
  FROM (
    SELECT v_plan.created_by AS user_id
    UNION
    SELECT rs.user_id
    FROM public.rsvps rs
    WHERE rs.plan_id = NEW.plan_id AND rs.response = 'yes'
    UNION
    SELECT da.user_id
    FROM public.date_availability da
    WHERE da.plan_id = NEW.plan_id
      AND da.available
      AND v_plan.plan_type = 'flexible'
      AND v_plan.status = 'open'
    UNION
    SELECT pc.author_id
    FROM public.plan_comments pc
    WHERE pc.plan_id = NEW.plan_id
  ) AS r
  WHERE r.user_id <> NEW.author_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE b.blocker_id = NEW.author_id AND b.blocked_id = r.user_id
    )
    AND public.can_view_plan_as(
      r.user_id, v_plan.id, v_plan.audience, v_plan.group_id, v_plan.created_by
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_plan_comment
  AFTER INSERT ON public.plan_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_plan_comment();


-- 6. Realtime -------------------------------------------------------------------
--
-- RLS still decides what each subscriber receives, so a table-wide listener
-- delivers a comment only to people the SELECT policy above would show it to.

ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_comments;
