// Maps admin routes to a tab label + purpose for the Admin Copilot context.
export type AdminTabContext = { path: string; label: string; purpose: string };

const TABS: AdminTabContext[] = [
  { path: '/admin', label: 'Dashboard', purpose: 'Top-level platform overview, KPIs, and quick links.' },
  { path: '/admin/owner-console', label: 'Owner Console', purpose: 'Owner-only controls and high-impact platform switches.' },
  { path: '/admin/influencers', label: 'Influencer Links', purpose: 'Manage influencer referral codes, attribution, and payouts.' },
  { path: '/admin/users', label: 'Users', purpose: 'Search, suspend, reactivate users, manage strikes and admin roles.' },
  { path: '/admin/instructors', label: 'Instructors', purpose: 'Verify instructors, review credentials, manage instructor accounts.' },
  { path: '/admin/courses', label: 'Courses', purpose: 'Browse, publish, unpublish, or remove courses.' },
  { path: '/admin/waivers', label: 'Course Waivers', purpose: 'Inspect and manage student waiver acceptances per course.' },
  { path: '/admin/course-editor', label: 'Force-Edit Courses', purpose: 'Override and edit course details on behalf of instructors.' },
  { path: '/admin/featured', label: 'Featured Courses', purpose: 'Curate which courses appear as featured in discovery.' },
  { path: '/admin/conversations', label: 'Conversations', purpose: 'Inspect user-to-user conversations for moderation and disputes.' },
  { path: '/admin/moderation', label: 'AI Moderation', purpose: 'Review AI-flagged content (courses, profiles, messages); approve/reject.' },
  { path: '/admin/deposit-review', label: 'Deposit Review', purpose: 'Triage stuck/awaiting/failed booking deposits and confirm or fail them.' },
  { path: '/admin/financials', label: 'Financials', purpose: 'Platform revenue, payouts, fees, and ledger summaries.' },
  { path: '/admin/fee-overrides', label: 'Fee Overrides', purpose: 'Per-instructor or per-course fee overrides.' },
  { path: '/admin/refunds', label: 'Refund Credits', purpose: 'Issue refunds and platform credits to users.' },
  { path: '/admin/bug-triage', label: 'Bug Triage AI', purpose: 'AI-assisted clustering and triage of incoming bug reports.' },
  { path: '/admin/reliability', label: 'Reliability', purpose: 'Service health, error rates, backup rails, payment failover.' },
  { path: '/admin/reports', label: 'Issue Reports', purpose: 'User-submitted bug reports inbox.' },
  { path: '/admin/feedback', label: 'User Suggestions', purpose: 'User-submitted feature suggestions; triage status (new/planned/shipped).' },
  { path: '/admin/support', label: 'Support Tickets', purpose: 'Open/closed support tickets from users.' },
  { path: '/admin/activity', label: 'Audit Log', purpose: 'Recent admin actions for compliance and review.' },
  { path: '/admin/flags', label: 'Feature Flags', purpose: 'Toggle feature flags on/off platform-wide.' },
  { path: '/admin/test-accounts', label: 'Test Accounts', purpose: 'Manage fake onboarding/test accounts for QA.' },
  { path: '/admin/warrior-quotes', label: 'Warrior Quotes', purpose: 'Manage motivational quotes shown across the app.' },
  { path: '/admin/security', label: 'Security', purpose: 'Security posture: keys, sessions, sensitive settings.' },
  { path: '/admin/helcim-webhooks', label: 'Helcim Webhooks', purpose: 'Inspect and replay Helcim payment webhooks.' },
  { path: '/admin/refund-test', label: 'Live Refund Test', purpose: 'Run live refund test transactions against Helcim.' },
  { path: '/admin/uptime', label: 'Uptime & Domains', purpose: 'Monitor uptime, custom domains, DNS health.' },
  { path: '/admin/background-videos', label: 'Background Videos', purpose: 'Curate splash/background video assets.' },
  { path: '/admin/subscription-plans', label: 'Subscription Plans', purpose: 'Create/edit subscription plans and validate them with AI before going live.' },
  { path: '/admin/settings', label: 'Platform Settings', purpose: 'Global platform settings (fees, limits, copy).' },
];

export function getAdminTabContext(pathname: string): AdminTabContext | null {
  // Longest-prefix match so nested routes resolve to their parent tab.
  const match = TABS
    .filter((t) => pathname === t.path || pathname.startsWith(t.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ?? null;
}
