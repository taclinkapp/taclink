ALTER TABLE public.influencer_links ADD COLUMN IF NOT EXISTS access_pin text;

-- Backfill via existing generator for any rows
UPDATE public.influencer_links
SET access_pin = public.generate_access_pin()
WHERE access_pin IS NULL;