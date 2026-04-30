import { MobileShell, PageHeader } from '@/components/MobileShell';
import { LegalAccountBanner } from '@/components/legal/LegalAccountBanner';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By using TacLink™, you agree to these Terms of Service. TacLink™ is a booking and scheduling platform connecting students with independent tactical training instructors. We do not conduct training ourselves.',
  },
  {
    title: '2. Booking Fee & Online Payment',
    body: 'TacLink charges the student online at booking for the FULL course price plus a $25 TacLink platform fee. The $25 platform fee is non-refundable outside the cancellation grace window. No payment is owed in person — all course fees flow through TacLink and are paid out to the instructor via Stripe Connect 24 hours after course completion.',
  },
  {
    title: '2a. Instructional Services Only',
    body: 'TacLink is a marketplace exclusively for instructional services related to firearms safety, defensive training, and tactical education. Instructors agree to use TacLink only for offering and accepting bookings for instructional services. Sale of merchandise — including but not limited to firearms, ammunition, magazines, optics, holsters, apparel, or any physical goods — through TacLink checkout, listings, or messaging is strictly prohibited. Violations may result in immediate account termination, forfeiture of held funds pending investigation, and removal from the platform.',
  },
  {
    title: '3. Instructor Responsibility',
    body: 'Instructors are independent contractors, not TacLink employees. TacLink does not verify the accuracy of instructor credentials, course content, or safety practices beyond the verified badge program. Students train at their own risk.',
  },
  {
    title: '4. Liability Waiver — Between Student and Instructor Only',
    body: 'Tactical training involves inherent risks including physical injury, permanent disability, and death. Each instructor publishes their own course-specific liability waiver, which the student must read and electronically sign before completing a booking.\n\nIMPORTANT — TacLink is NOT a party to the waiver:\n\n• The waiver is a legal agreement solely between the STUDENT (or, for minors, the parent/legal guardian) and the INSTRUCTOR.\n• TacLink acts exclusively as a neutral RECORD-KEEPER. We store the signed waiver, the immutable content snapshot, the timestamp, the version, the ESIGN/UETA consent record, and (where applicable) the parent/guardian co-signature, and make these records available to both parties.\n• TacLink does NOT draft, review, endorse, or guarantee the legal sufficiency or enforceability of any waiver. AI-generated waiver drafts offered to instructors are starting templates only and are not legal advice. Instructors are solely responsible for having their waivers reviewed by licensed counsel in their jurisdiction.\n• TacLink does NOT assume the instructor\'s liability and is not liable for injuries, property damage, illness, or losses incurred during training, nor for any defect, omission, or unenforceability in the waiver itself.\n\nElectronic Signatures (ESIGN / UETA): Signatures collected through TacLink are made under the federal ESIGN Act and the Uniform Electronic Transactions Act (UETA). Students explicitly consent to electronic signature, type their initials acknowledging that consent, and may withdraw consent at any time before signing. A copy of the signed waiver is retained in the student\'s account.\n\nMinors: If the student is under 18, a parent or legal guardian must co-sign the waiver and supply their relationship to the minor. The guardian\'s name, relationship, and timestamped consent are recorded alongside the student\'s signature.',
  },
  {
    title: '5. Firearms & Legal Compliance',
    body: 'All firearms training must comply with applicable federal, state, and local laws. Users are responsible for ensuring they are legally permitted to possess and use firearms in their jurisdiction. TacLink does not facilitate illegal activity.',
  },
  {
    title: '6. Cancellations & Refunds',
    body: "TacLink charges the student online at booking: the full course price plus a $25 TacLink platform fee. Funds are held in escrow by TacLink and released to the instructor's Stripe Connect account 24 hours after course end time, provided the instructor scanned the student's check-in QR code at the course.\n\nIf the instructor never scans the student in (no-show on the instructor's part), the full amount is automatically refunded to the student.\n\nStudent cancellation grace period (tiered by lead time at booking):\nThe cancellation window is calculated at the moment of booking based on how far in advance the student books. Cancelling within the window returns a full refund (course price + $25 platform fee) in cash to the original payment method via Stripe within 48 hours.\n• Booked 7+ days before the course start: 72-hour grace window for full refund.\n• Booked 3–7 days before the course start: 48-hour grace window for full refund.\n• Booked 1–3 days before the course start: 24-hour grace window for full refund.\n• Booked less than 24 hours before the course start: no grace window — late-cancel rules apply immediately.\n\nThe applicable deadline is shown to the student on the My Bookings list and on the booking detail page as a live countdown.\n\nRefund matrix (all student refunds are returned in cash to the original payment method via Stripe within 48 hours — TacLink does not issue in-app credits):\n• Instructor cancels at any time, no-shows, or a fraud/safety incident is confirmed: Student receives 100% back in cash (full course price + $25 platform fee). Instructor may receive a strike on their account.\n• Student cancels within their tiered grace window: 100% refund (full course price + $25 platform fee).\n• Student cancels after the tiered grace window or no-shows: Student receives 90% of the course price back in cash. The instructor receives the remaining 10% of the course price as compensation for the lost slot. TacLink retains the $25 platform fee.\n• Weather, sickness, or mutual reschedule: TacLink encourages rescheduling the booking to a new date with the same instructor at no additional platform fee. No refund is issued unless rescheduling is impossible.\n• Quality complaints after attending: Reviewed case-by-case at TacLink's discretion. Funds, once released to the instructor, are not clawed back automatically.\n\nAll course payments flow through TacLink. Any side payments arranged off-platform between a student and instructor (cash, Venmo, Zelle, etc.) are a violation of these Terms (see Section 10) and are not refundable by TacLink.",
  },
  {
    title: '7. Prohibited Conduct',
    body: 'Users may not use TacLink to facilitate illegal training, discriminate against protected classes, post false credentials, or engage in harassment. Violations may result in account termination.',
  },
  {
    title: '8. Changes to Terms',
    body: 'TacLink reserves the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.',
  },
  {
    title: '9. Contact',
    body: 'For questions about these terms, contact us at legal@taclink.app.',
  },
  {
    title: '10. Anti-Circumvention Policy',
    body: 'Instructor contact information (phone, email, and payment details) is disclosed exclusively to students who have completed a booking through TacLink and paid the applicable booking fee. You agree not to use any instructor contact information obtained through TacLink to arrange, negotiate, or complete future bookings, payments, or training engagements outside of the TacLink platform. Each booking generates a unique traceable reference code ("Booking Reference") that is permanently linked to your account. Evidence of off-platform circumvention — including direct payment to instructors for courses not booked through TacLink — constitutes a material breach of these Terms and may result in immediate account suspension, forfeiture of any active bookings, and civil liability for damages. Instructors who solicit or accept off-platform bookings from students they met through TacLink are subject to the same penalties, including permanent removal from the platform.',
  },
];

const TermsOfService = () => (
  <MobileShell withTabBar={false}>
    <PageHeader title="Terms of Service" back />
    <div className="px-4 py-4 space-y-4">
      <LegalAccountBanner documentName="Terms of Service" />
      <p className="text-xs text-muted-foreground">Last updated: April 30, 2026</p>
      {SECTIONS.map((s) => (
        <section key={s.title} className="tactical-card p-4">
          <h2 className="font-bold text-sm mb-2">{s.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{s.body}</p>
        </section>
      ))}
      <div className="h-6" />
    </div>
  </MobileShell>
);

export default TermsOfService;
