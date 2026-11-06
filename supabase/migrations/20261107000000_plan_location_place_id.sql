-- PLA-156: a plan's place can point at a real one.
--
-- `location` stays what it always was, the host's own words, and it is what
-- everyone reads. This column only says which real place those words mean, so
-- Map can open it. A place id is the one thing Google's terms let us keep
-- indefinitely: its names, addresses and coordinates are never stored here.
--
-- An id needs words. The Maps link requires a `query`, and it is what Google
-- falls back to if the id ever goes stale, so a plan cannot carry an id alone.
-- Google states no maximum length for an id, so the limit is only a guard
-- against junk from a hand-rolled client.
ALTER TABLE public.plans
  ADD COLUMN location_place_id TEXT,
  ADD CONSTRAINT plans_place_id_needs_location
    CHECK (location_place_id IS NULL OR location IS NOT NULL),
  ADD CONSTRAINT plans_place_id_length
    CHECK (char_length(location_place_id) <= 1024);

-- 20260802000002 lists the columns a client may update, and a new column stays
-- unwritable until it joins them.
GRANT UPDATE (location_place_id) ON public.plans TO authenticated;

COMMENT ON COLUMN public.plans.location_place_id IS
  'Google place id for the place the host picked. Null for free text.';
