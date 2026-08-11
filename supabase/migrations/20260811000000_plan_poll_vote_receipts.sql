-- PLA-95: a poll leaves the feed after a person has voted once.
--
-- plan_poll_votes is deliberately current state: changing a pick updates its
-- row, and clearing a pick deletes it. Feed visibility needs a different fact:
-- whether this person has ever answered this poll. Keep that fact in a receipt
-- which the vote trigger writes and a later withdrawal never touches.

CREATE TABLE public.plan_poll_vote_receipts (
  poll_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id),
  FOREIGN KEY (poll_id, plan_id)
    REFERENCES public.plan_polls (id, plan_id) ON DELETE CASCADE
);

CREATE INDEX idx_plan_poll_vote_receipts_plan
  ON public.plan_poll_vote_receipts(plan_id);

CREATE OR REPLACE FUNCTION public.remember_plan_poll_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.plan_poll_vote_receipts (poll_id, plan_id, user_id)
  VALUES (NEW.poll_id, NEW.plan_id, NEW.user_id)
  ON CONFLICT (poll_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- UPDATE is included so an old or partially migrated row repairs its missing
-- receipt the next time the person changes their pick.
CREATE TRIGGER trg_remember_plan_poll_vote
  AFTER INSERT OR UPDATE OF option_id ON public.plan_poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.remember_plan_poll_vote();

-- Existing votes are already proof that the person answered. The trigger is
-- installed first so votes written while this backfill runs also get receipts.
INSERT INTO public.plan_poll_vote_receipts (poll_id, plan_id, user_id, first_voted_at)
SELECT poll_id, plan_id, user_id, MIN(created_at)
FROM public.plan_poll_votes
GROUP BY poll_id, plan_id, user_id
ON CONFLICT (poll_id, user_id) DO NOTHING;

ALTER TABLE public.plan_poll_vote_receipts ENABLE ROW LEVEL SECURITY;

-- A receipt is private feed state. Poll tallies remain visible to the group,
-- but nobody needs to know who has previously voted and since cleared.
CREATE POLICY "People can view their own poll vote receipts"
  ON public.plan_poll_vote_receipts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
