
-- 1. Schema additions
ALTER TABLE public.founding_instructors
  ADD COLUMN IF NOT EXISTS override_plan_id uuid REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS override_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS override_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_updated_by uuid;

-- Backfill default plan = instructor_pro_monthly for existing rows
UPDATE public.founding_instructors fi
   SET override_plan_id = sp.id
  FROM public.subscription_plans sp
 WHERE sp.slug = 'instructor_pro_monthly'
   AND fi.override_plan_id IS NULL;

-- 2. Updated entitlement check: honor enabled flag + plan
CREATE OR REPLACE FUNCTION public.has_pro_access(_user_id uuid, _env text DEFAULT 'live'::text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_active_subscription(_user_id, _env)
    OR EXISTS (
      SELECT 1
        FROM public.founding_instructors fi
        LEFT JOIN public.subscription_plans sp ON sp.id = fi.override_plan_id
       WHERE fi.user_id = _user_id
         AND fi.founder_status = 'active'
         AND fi.override_enabled = true
         AND fi.free_pro_starts_at IS NOT NULL
         AND fi.free_pro_starts_at <= now()
         AND (fi.free_pro_ends_at IS NULL OR fi.free_pro_ends_at > now())
         AND (sp.slug IS NULL OR sp.slug = 'instructor_pro_monthly')
    );
$function$;

-- 3. Admin RPC: set plan, window, on/off, note
CREATE OR REPLACE FUNCTION public.admin_set_founder_access(
  _user_id uuid,
  _plan_id uuid,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _enabled boolean,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row public.founding_instructors%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  IF _starts_at IS NOT NULL AND _ends_at IS NOT NULL AND _ends_at <= _starts_at THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  IF _plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = _plan_id) THEN
    RAISE EXCEPTION 'Invalid plan id';
  END IF;

  UPDATE public.founding_instructors
     SET override_plan_id    = COALESCE(_plan_id, override_plan_id),
         free_pro_starts_at  = COALESCE(_starts_at, free_pro_starts_at),
         free_pro_ends_at    = _ends_at,
         override_enabled    = _enabled,
         notes               = COALESCE(_note, notes),
         override_updated_at = now(),
         override_updated_by = auth.uid(),
         -- Auto-activate when admin enables and we have a start window
         founder_status      = CASE
           WHEN _enabled AND COALESCE(_starts_at, free_pro_starts_at) IS NOT NULL
                AND founder_status IN ('pending_prelaunch','expired')
             THEN 'active'::founder_status
           ELSE founder_status
         END,
         updated_at = now()
   WHERE user_id = _user_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Founder row not found for user';
  END IF;

  RETURN to_jsonb(v_row);
END $$;

-- 4. Admin RPC: quick toggle on/off
CREATE OR REPLACE FUNCTION public.admin_toggle_founder_access(_user_id uuid, _enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row public.founding_instructors%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  UPDATE public.founding_instructors
     SET override_enabled    = _enabled,
         override_updated_at = now(),
         override_updated_by = auth.uid(),
         updated_at          = now()
   WHERE user_id = _user_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Founder row not found for user';
  END IF;

  RETURN to_jsonb(v_row);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_set_founder_access(uuid, uuid, timestamptz, timestamptz, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_founder_access(uuid, boolean) TO authenticated;
