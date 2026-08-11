-- PLA-97: the private feedback inbox on planazo.me.
--
-- Feedback stays write-only for ordinary users. A separate app-level admin
-- grant lets the web dashboard read every submission and its private
-- screenshot, while narrow RPCs own the three allowed state transitions.

CREATE TABLE public.app_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_admins
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- Resolve the owner's email once. The durable grant is the immutable auth
-- UUID, so a later email change neither grants nor removes admin access.
INSERT INTO public.app_admins (user_id)
SELECT id
FROM auth.users
WHERE lower(email) = lower('devinci.maker@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.feedback
  ADD COLUMN resolution TEXT NOT NULL DEFAULT 'unresolved'
    CHECK (resolution IN ('unresolved', 'creating_linear', 'linear_issue', 'dismissed')),
  ADD COLUMN resolution_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN linear_issue_id UUID,
  ADD COLUMN linear_issue_identifier TEXT,
  ADD COLUMN linear_issue_url TEXT,
  ADD CONSTRAINT feedback_linear_issue_shape CHECK (
    (
      resolution = 'linear_issue'
      AND linear_issue_id IS NOT NULL
      AND linear_issue_identifier IS NOT NULL
      AND linear_issue_url IS NOT NULL
    )
    OR
    (
      resolution <> 'linear_issue'
      AND linear_issue_id IS NULL
      AND linear_issue_identifier IS NULL
      AND linear_issue_url IS NULL
    )
  );

CREATE INDEX feedback_inbox_idx
  ON public.feedback (resolution, created_at DESC);

CREATE POLICY "App admins can read feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (public.is_app_admin());

CREATE POLICY "App admins can read feedback screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND public.is_app_admin()
  );

CREATE OR REPLACE FUNCTION public.claim_feedback_for_linear(p_feedback_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'App admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.feedback
  SET resolution = 'creating_linear', resolution_updated_at = now()
  WHERE id = p_feedback_id AND resolution = 'unresolved';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_feedback_from_linear(p_feedback_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'App admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.feedback
  SET resolution = 'unresolved', resolution_updated_at = now()
  WHERE id = p_feedback_id AND resolution = 'creating_linear';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_feedback_linear_issue(
  p_feedback_id UUID,
  p_linear_issue_id UUID,
  p_linear_issue_identifier TEXT,
  p_linear_issue_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'App admin access required' USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(p_linear_issue_identifier), '') IS NULL
     OR nullif(trim(p_linear_issue_url), '') IS NULL THEN
    RAISE EXCEPTION 'Linear issue identity is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.feedback
  SET resolution = 'linear_issue',
      resolution_updated_at = now(),
      linear_issue_id = p_linear_issue_id,
      linear_issue_identifier = trim(p_linear_issue_identifier),
      linear_issue_url = trim(p_linear_issue_url)
  WHERE id = p_feedback_id AND resolution = 'creating_linear';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_feedback(p_feedback_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'App admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.feedback
  SET resolution = 'dismissed', resolution_updated_at = now()
  WHERE id = p_feedback_id AND resolution = 'unresolved';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_feedback(p_feedback_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'App admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.feedback
  SET resolution = 'unresolved', resolution_updated_at = now()
  WHERE id = p_feedback_id AND resolution IN ('dismissed', 'creating_linear');

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_feedback_for_linear(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_feedback_from_linear(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_feedback_linear_issue(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dismiss_feedback(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reopen_feedback(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_feedback_for_linear(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_feedback_from_linear(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_feedback_linear_issue(UUID, UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_feedback(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_feedback(UUID) TO authenticated;

COMMENT ON TABLE public.app_admins IS
  'Application operators allowed into private planazo.me admin surfaces.';

COMMENT ON COLUMN public.feedback.resolution IS
  'Inbox outcome. creating_linear is an internal duplicate-prevention lock.';
