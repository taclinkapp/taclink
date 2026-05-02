
DROP VIEW IF EXISTS public.influencer_links_public CASCADE;
DROP POLICY IF EXISTS "Public reads safe columns of active links" ON public.influencer_links;

CREATE VIEW public.influencer_links_public AS
SELECT id, slug, audience, active, created_at
FROM public.influencer_links
WHERE active = true;

GRANT SELECT ON public.influencer_links_public TO anon, authenticated;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users subscribe to own channels" ON realtime.messages;
CREATE POLICY "Authenticated users subscribe to own channels"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    (realtime.topic() IN ('messages', 'public'))
    OR (realtime.topic() = 'user:' || auth.uid()::text)
    OR (
      realtime.topic() LIKE 'conversation:%'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
         WHERE c.id::text = split_part(realtime.topic(), ':', 2)
           AND (c.student_id = auth.uid()::text OR c.instructor_id = auth.uid()::text)
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users send to own channels" ON realtime.messages;
CREATE POLICY "Authenticated users send to own channels"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    (realtime.topic() = 'user:' || auth.uid()::text)
    OR (
      realtime.topic() LIKE 'conversation:%'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
         WHERE c.id::text = split_part(realtime.topic(), ':', 2)
           AND (c.student_id = auth.uid()::text OR c.instructor_id = auth.uid()::text)
      )
    )
  );

ALTER TABLE public.test_accounts DROP COLUMN IF EXISTS password;

UPDATE auth.users
   SET banned_until = 'infinity'::timestamptz
 WHERE email LIKE '%@dev.taclink.local';
