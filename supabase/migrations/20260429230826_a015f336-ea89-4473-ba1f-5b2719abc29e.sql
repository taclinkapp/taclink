-- Backfill: the dispute_triage row stored an empty payload because the model
-- returned classification/recommended_action at the top level. Reconstruct
-- a reasonable payload from the preview text so the cockpit badge renders.
UPDATE public.ai_actions
   SET payload = jsonb_build_object(
     'classification', 'instructor_no_show',
     'recommended_action', 'approve_full_refund',
     'reply_text', 'Thank you for letting us know. We''re escalating this to our team to investigate the no-show. If confirmed, we''ll issue an in-app credit covering your platform fee and deposit toward a future booking. — the TacLink team',
     'internal_note', 'Backfilled — see preview/reasoning fields.'
   )
 WHERE id = '7204f4cb-e2f2-4e3b-b423-210a6f04e36c'
   AND (payload IS NULL OR payload = '{}'::jsonb);