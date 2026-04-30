
CREATE TABLE public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_user_env ON public.subscriptions(user_id, environment, created_at DESC);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active', 'trialing', 'past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

-- Mirror latest subscription status onto profiles.subscription_status
-- so existing Pro gates (which check profile.subscription_status === 'active') keep working.
CREATE OR REPLACE FUNCTION public.sync_profile_subscription_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_active boolean;
BEGIN
  v_user := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = v_user
      AND (
        (status IN ('active', 'trialing', 'past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  ) INTO v_active;

  UPDATE public.profiles
     SET subscription_status = CASE WHEN v_active THEN 'active' ELSE 'free' END,
         subscription_updated_at = now(),
         updated_at = now()
   WHERE id = v_user;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_subscriptions_sync_profile
AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_subscription_status();

CREATE TRIGGER set_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
