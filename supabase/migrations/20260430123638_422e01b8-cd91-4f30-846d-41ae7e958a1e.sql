
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_deposit_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_deposit_status_check CHECK (
    deposit_status = ANY (ARRAY[
      'not_required',
      'pending_payment',
      'held_in_escrow',
      'released',
      'refunded',
      'forfeited',
      'pending_send',
      'awaiting_confirmation',
      'confirmed',
      'expired'
    ])
  );
