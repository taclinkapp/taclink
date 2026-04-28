-- Support alternate payment methods (Cash App, Venmo, PayPal, Zelle) alongside cards
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS method_type text NOT NULL DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS handle text;

ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_method_type_check
  CHECK (method_type IN ('card', 'cashapp', 'venmo', 'paypal', 'zelle'));

-- Card fields only required when method_type = 'card'
ALTER TABLE public.payment_methods ALTER COLUMN brand DROP NOT NULL;
ALTER TABLE public.payment_methods ALTER COLUMN last4 DROP NOT NULL;
ALTER TABLE public.payment_methods ALTER COLUMN exp_month DROP NOT NULL;
ALTER TABLE public.payment_methods ALTER COLUMN exp_year DROP NOT NULL;
ALTER TABLE public.payment_methods ALTER COLUMN cardholder_name DROP NOT NULL;

ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_card_fields_required
  CHECK (
    method_type <> 'card'
    OR (brand IS NOT NULL AND last4 IS NOT NULL AND exp_month IS NOT NULL AND exp_year IS NOT NULL AND cardholder_name IS NOT NULL)
  );

ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_handle_required
  CHECK (method_type = 'card' OR (handle IS NOT NULL AND length(trim(handle)) > 0));