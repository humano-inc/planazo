-- PLA-140: the name on a friends-of-friends card ("via Marta").
--
-- A computed column on plans. PostgREST exposes a function whose single
-- argument is the table's row type as a selectable field, so the feed and the
-- detail screen read the bridge in the same round trip as the plan rather
-- than fanning out a request per card. friendships is party-readable, hence
-- SECURITY DEFINER; the bridge obeys the sight rule from PLA-139: an accepted
-- friend of both the viewer and the creator, who has not blocked the viewer.
--
-- Null whenever there is nothing to say: a group or friends plan, the creator
-- looking at their own plan, or a direct friend, who needs no bridge. Several
-- bridges collapse to one, alphabetically, so the card is stable across
-- refetches.
--
-- The argument is unnamed on purpose: the generated types only recognise a
-- computed column when the row parameter has no name.
CREATE OR REPLACE FUNCTION public.plan_bridge(public.plans)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.display_name
  FROM profiles pr
  WHERE $1.audience = 'friends_of_friends'
    AND auth.uid() IS NOT NULL
    AND $1.created_by IS NOT NULL
    AND $1.created_by <> auth.uid()
    AND NOT is_friend($1.created_by)
    AND pr.id IN (SELECT friend_ids(auth.uid()) INTERSECT SELECT friend_ids($1.created_by))
    AND NOT EXISTS (
      SELECT 1 FROM blocked_users b
      WHERE b.blocker_id = pr.id AND b.blocked_id = auth.uid()
    )
  ORDER BY pr.display_name, pr.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.plan_bridge(public.plans) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plan_bridge(public.plans) TO authenticated;
