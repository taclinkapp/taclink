INSERT INTO public.platform_settings (key, value)
VALUES ('prelaunch_unlock_notified_at', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;