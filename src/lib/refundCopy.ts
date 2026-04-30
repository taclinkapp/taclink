// Single source of truth for student-facing refund copy.
// Mirrors the Terms of Service refund matrix exactly so every preview,
// confirm dialog, and status page shows the same wording.
//
// Terms reference (TermsOfService.tsx §6):
//   - Timely cancel  → 100% refund ($25 platform fee + full course price).
//   - Late cancel    → 90% of course price refunded; instructor keeps 10%
//                       as compensation; $25 platform fee non-refundable.
//   - Instructor cancel/no-show → 100% refund ($25 + course price), 48h SLA.

export const REFUND_GRACE_HEADLINE =
  '100% refund ($25 platform fee + full course price)';

export const REFUND_LATE_HEADLINE =
  '90% of the course price back · instructor keeps 10% · $25 platform fee non-refundable';

export const REFUND_INSTRUCTOR_FAULT_HEADLINE =
  '100% refund ($25 + full course price) within 48 hours';

export const REFUND_POLICY_BLURB =
  "Cancel within your grace window for a 100% refund ($25 platform fee + full course price). " +
  "After the grace window, you receive 90% of the course price back — the instructor keeps 10% " +
  "for the lost slot, and the $25 platform fee is non-refundable. " +
  "If the instructor cancels or no-shows, you're refunded in full ($25 + course price) within 48 hours.";

export const cancelConfirmMessage = (inGrace: boolean) =>
  inGrace
    ? `Cancel this booking?\n\nYou are within your grace window — ${REFUND_GRACE_HEADLINE} will be refunded to your card within 48 hours.`
    : `Cancel this booking?\n\nYou are past your grace window. ${REFUND_LATE_HEADLINE}.\n\nThis cannot be undone.`;

export const instructorNoShowConfirmMessage = () =>
  `Report that the instructor did not show up?\n\nThis will cancel your booking and issue a ${REFUND_INSTRUCTOR_FAULT_HEADLINE}. ` +
  `A strike will also be added to the instructor's account. Only use this if the instructor truly did not appear.`;

export const cancelButtonLabel = (inGrace: boolean) =>
  inGrace ? 'Cancel for 100% refund' : 'Cancel booking (90% refund · keep $25 fee)';
