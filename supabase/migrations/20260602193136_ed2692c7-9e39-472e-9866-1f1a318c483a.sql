-- Prevent duplicate "owed" instructor ledger entries when the Helcim webhook
-- and the confirm-helcim-payment client call race for the same booking.
-- Existing logic does SELECT-then-INSERT, which is not atomic; both branches
-- can pass the "no existing row" check and double-credit the instructor.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_ledger_booking_owed
  ON public.instructor_ledger(booking_id)
  WHERE entry_type = 'owed' AND booking_id IS NOT NULL;