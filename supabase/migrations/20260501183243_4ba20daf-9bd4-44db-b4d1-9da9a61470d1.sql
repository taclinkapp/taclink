-- Warrior quotes library
CREATE TABLE public.warrior_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  author text NOT NULL,
  source_note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_warrior_quotes_active ON public.warrior_quotes(is_active) WHERE is_active = true;

ALTER TABLE public.warrior_quotes ENABLE ROW LEVEL SECURITY;

-- Anyone (logged in or not) can read active quotes
CREATE POLICY "Anyone can read active warrior quotes"
  ON public.warrior_quotes FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage warrior quotes"
  ON public.warrior_quotes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Settings (single row, id = 1)
CREATE TABLE public.warrior_quote_settings (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  display_style text NOT NULL DEFAULT 'watermark',  -- watermark | banner | corner | ticker
  opacity numeric NOT NULL DEFAULT 0.06,            -- 0..1, used by watermark
  show_to_students boolean NOT NULL DEFAULT true,
  show_to_instructors boolean NOT NULL DEFAULT true,
  rotation text NOT NULL DEFAULT 'daily',           -- daily | hourly | per_visit
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT singleton_row CHECK (id = 1),
  CONSTRAINT valid_display_style CHECK (display_style IN ('watermark','banner','corner','ticker')),
  CONSTRAINT valid_rotation CHECK (rotation IN ('daily','hourly','per_visit')),
  CONSTRAINT valid_opacity CHECK (opacity >= 0 AND opacity <= 1)
);

ALTER TABLE public.warrior_quote_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read warrior quote settings"
  ON public.warrior_quote_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage warrior quote settings"
  ON public.warrior_quote_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default settings row
INSERT INTO public.warrior_quote_settings (id) VALUES (1);

-- Reuse existing updated_at trigger function if it exists, otherwise create
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER warrior_quotes_touch
  BEFORE UPDATE ON public.warrior_quotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER warrior_quote_settings_touch
  BEFORE UPDATE ON public.warrior_quote_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();