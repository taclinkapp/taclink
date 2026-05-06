import { MobileShell, PageHeader } from '@/components/MobileShell';
import { LegalAccountBanner } from '@/components/legal/LegalAccountBanner';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'We collect information you provide directly: name, email address, app role (student/instructor), and any profile information you enter. We also collect usage data such as courses viewed, bookings made, and features used.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'We use your information to: operate the TacLink™ platform, process course bookings, send booking confirmations and reminders, improve the app experience, and communicate with you about your account.',
  },
  {
    title: '3. Information Sharing',
    body: 'When you book a course, your name and contact information is shared with the instructor to facilitate the training. We do not sell your personal information to third parties.',
  },
  {
    title: '4. Instructor Profiles',
    body: 'Instructor profiles including name, bio, credentials, and course listings are publicly visible to all TacLink users. Instructors should not include sensitive personal information in their public profile.',
  },
  {
    title: '5. Data Security',
    body: 'We use industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure. Use a strong, unique password for your account.',
  },
  {
    title: '6. Data Retention',
    body: 'We retain your account data as long as your account is active. You may request deletion of your account and associated data by contacting privacy@taclink.app.',
  },
  {
    title: '7. Your Rights',
    body: 'You have the right to access, correct, or delete your personal data. Contact privacy@taclink.app to exercise these rights. California residents have additional rights under CCPA.',
  },
  {
    title: "8. Children's Privacy",
    body: 'TacLink is not intended for users under 18 years of age. We do not knowingly collect personal information from minors.',
  },
  {
    title: '9. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. We will notify you of significant changes via the app or email.',
  },
  {
    title: '10. Contact',
    body: 'For privacy questions or data requests, contact us at privacy@taclink.app.',
  },
];

const PrivacyPolicy = () => (
  <MobileShell withTabBar={false}>
    <PageHeader title="Privacy Policy" back backTo="/" />
    <div className="px-4 py-4 space-y-4">
      <LegalAccountBanner documentName="Privacy Policy" />
      <p className="text-xs text-muted-foreground">Last updated: April 2026</p>
      {SECTIONS.map((s) => (
        <section key={s.title} className="tactical-card p-4">
          <h2 className="font-bold text-sm mb-2">{s.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
        </section>
      ))}
      <div className="h-6" />
    </div>
  </MobileShell>
);

export default PrivacyPolicy;
