
DELETE FROM public.notifications WHERE recipient_id = '22222222-2222-2222-2222-222222222222' AND type = 'deposit_forfeited';
DELETE FROM public.refunds WHERE booking_id = 'bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb';
DELETE FROM public.bookings WHERE id = 'bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb';
DELETE FROM public.courses WHERE id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
UPDATE public.profiles SET strike_points = 0, account_status = 'active' WHERE id = '22222222-2222-2222-2222-222222222222' AND strike_points <= 2;
