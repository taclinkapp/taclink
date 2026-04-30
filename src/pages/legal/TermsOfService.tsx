import { MobileShell, PageHeader } from '@/components/MobileShell';
import { LegalAccountBanner } from '@/components/legal/LegalAccountBanner';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By using TacLink™, you agree to these Terms of Service. TacLink™ is a booking and scheduling platform connecting students with independent tactical training instructors. We do not conduct training ourselves.',
  },
  {
    title: '2. Booking Fee',
    body: 'A non-refundable $25 TacLink booking fee is charged per course reservation. This fee secures your seat and is separate from the course price charged by the instructor. Course fees are paid directly to the instructor per their stated payment instructions.',
  },
  {
    title: '3. Instructor Responsibility',
    body: 'Instructors are independent contractors, not TacLink employees. TacLink does not verify the accuracy of instructor credentials, course content, or safety practices beyond the verified badge program. Students train at their own risk.',
  },
  {
    title: '4. Liability Waiver',
    body: 'Tactical training involves inherent risks including physical injury. By booking a course, you acknowledge these risks and agree to sign any waivers required by the instructor. TacLink is not liable for injuries, property damage, or losses incurred during training.',
  },
  {
    title: '5. Firearms & Legal Compliance',
    body: 'All firearms training must comply with applicable federal, state, and local laws. Users are responsible for ensuring they are legally permitted to possess and use firearms in their jurisdiction. TacLink does not facilitate illegal activity.',
  },
  {
    title: '6. Cancellations & Refunds',
    body: "All refunds issued by TacLink are provided exclusively as in-app credit toward a future booking. TacLink does not issue cash refunds under any circumstances. In-app credit is non-transferable, has no cash value, and does not expire.\n\nRefund policy by reason:\n• Instructor no-show or cancellation, fraud, or safety incident: Student receives the $25 platform fee + 10% deposit as in-app credit. Instructor forfeits the deposit.\n• Student cancels at least 48 hours before the course start time: Student receives the $25 platform fee back as in-app credit. The 10% instructor deposit is non-refundable.\n• Student cancels less than 48 hours before, or no-shows: No credit is issued. The $25 platform fee and 10% deposit are forfeited.\n• Weather, sickness, transportation, or mutual reschedule: TacLink encourages rescheduling the booking to a new date with the same instructor at no additional platform fee. No credit is issued unless rescheduling is impossible.\n• Quality complaints after attending: Reviewed case-by-case at TacLink's discretion; goodwill credit may be issued.\n\nAny portion of a course fee paid in person to the instructor (cash, Venmo, or otherwise) is between the student and the instructor; TacLink cannot refund those amounts. Refund eligibility is determined by TacLink based on the circumstances and the categories above.",
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
      <p className="text-xs text-muted-foreground">Last updated: April 2026</p>
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
