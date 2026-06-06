// Per-tab "crash course" walkthrough content for the admin panel.
// Each course is keyed by id so localStorage can remember dismissal per tab,
// and matched by route prefix (longest match wins) so nested routes inherit.

export type CrashStep = {
  heading: string;
  body: string;
  bullets?: { label: string; text?: string }[];
  tip?: string;
};

export type CrashCourse = {
  id: string;
  /** Route prefix this course attaches to (longest prefix wins). */
  route: string;
  /** Set true when route must match exactly (used for /admin dashboard root). */
  exact?: boolean;
  title: string;
  subtitle: string;
  steps: CrashStep[];
};

export const CRASH_COURSES: CrashCourse[] = [
  {
    id: 'dashboard',
    route: '/admin',
    exact: true,
    title: 'Admin Dashboard',
    subtitle: 'Your control tower for the entire platform — here is how to read it.',
    steps: [
      {
        heading: 'What this page is',
        body: 'The dashboard is a single-glance health check. It surfaces totals (users, courses, revenue) and anything that needs your attention right now (pending approvals, refund queue, stuck deposits).',
        bullets: [
          { label: 'KPI cards', text: 'Live counts pulled from the database — click any card to jump to its detail tab.' },
          { label: 'Pending row', text: 'Items waiting on a human decision: instructor credentials, moderation, refund credits.' },
          { label: 'Recent activity', text: 'Latest signups, bookings, and payouts so you can spot anomalies fast.' },
        ],
        tip: 'If a number ever looks "stuck", tap the card — the underlying tab has filters and timestamps so you can drill in.',
      },
      {
        heading: 'Daily routine',
        body: 'Run the dashboard every morning. Clear anything red (pending approvals, stuck deposits, support tickets) before touching anything else.',
        bullets: [
          { label: '1. Approvals', text: 'Instructors → review pending credentials.' },
          { label: '2. Money', text: 'Deposit Review + Refund Credits → resolve stuck transactions.' },
          { label: '3. Safety', text: 'AI Moderation + Issue Reports → triage flagged content.' },
        ],
      },
      {
        heading: 'Re-open this tour anytime',
        body: 'The "Crash Course" button stays pinned in the bottom-left corner of every admin tab. Tap it whenever you want a refresher on the page you are looking at.',
        tip: 'Each tab has its own walkthrough — the button shows the right one for whatever tab you are on.',
      },
    ],
  },
  {
    id: 'owner-console',
    route: '/admin/owner-console',
    title: 'Owner Console',
    subtitle: 'High-leverage levers reserved for the platform owner.',
    steps: [
      {
        heading: 'What lives here',
        body: 'Top-level switches that change platform-wide behavior: prelaunch mode, AI features, payment provider failover. Treat each toggle as production-impacting.',
        tip: 'Read the description under every switch before you flip it — most affect every user immediately.',
      },
      {
        heading: 'When to use it',
        body: 'During launches, incidents, or pricing experiments. For day-to-day moderation use the dedicated tabs instead.',
      },
    ],
  },
  {
    id: 'influencers',
    route: '/admin/influencers',
    title: 'Influencer Links',
    subtitle: 'Create, track, and pay influencer referral links.',
    steps: [
      {
        heading: 'Create a link',
        body: 'Generate a unique handle for each influencer. The link auto-attributes signups + first bookings back to them for commission.',
        bullets: [
          { label: 'Handle', text: 'Short, memorable slug — used in the URL.' },
          { label: 'Commission %', text: 'Per-booking cut paid out monthly.' },
        ],
      },
      {
        heading: 'Read the metrics',
        body: 'Each row shows clicks → signups → paying users. Conversion drop-offs help you spot fake traffic vs. real audiences.',
      },
    ],
  },
  {
    id: 'users',
    route: '/admin/users',
    title: 'Users',
    subtitle: 'Search, audit, suspend, or impersonate any user.',
    steps: [
      {
        heading: 'Find a user fast',
        body: 'Search by email, name, or user ID. The result row shows roles, signup date, last activity, and account flags.',
      },
      {
        heading: 'Account actions',
        body: 'Click a user to open their detail panel.',
        bullets: [
          { label: 'Suspend', text: 'Blocks login and bookings; reversible.' },
          { label: 'Reset password', text: 'Sends a magic reset link to their email.' },
          { label: 'View as', text: 'Read-only support view of what they see — never charges or sends messages.' },
        ],
        tip: 'Every action is written to the Audit Log — explain "why" in the reason field so future-you knows.',
      },
    ],
  },
  {
    id: 'instructors',
    route: '/admin/instructors',
    title: 'Instructors',
    subtitle: 'Approve credentials, manage strikes, and verify payout setup.',
    steps: [
      {
        heading: 'Approve credentials',
        body: 'Pending instructors cannot publish until approved. Open each application, verify the uploaded license/cert against the issuing authority, then approve or reject with a note.',
        tip: 'Reject reasons are emailed to the instructor — be specific so they can fix and resubmit.',
      },
      {
        heading: 'Strikes & suspensions',
        body: 'Late cancellations and no-shows auto-add strikes. Manually add or clear strikes from the detail panel when warranted (weather, medical, etc.).',
      },
    ],
  },
  {
    id: 'courses',
    route: '/admin/courses',
    title: 'Courses',
    subtitle: 'Every course on the platform — published, draft, or cancelled.',
    steps: [
      {
        heading: 'Filter and audit',
        body: 'Use status filters to find courses needing attention: pending review, reported, or cancelled with refunds in flight.',
      },
      {
        heading: 'Force-edit when needed',
        body: 'For copy fixes that cannot wait on the instructor, use Force-Edit Courses (separate tab). Standard edits should always be done by the instructor.',
      },
    ],
  },
  {
    id: 'waivers',
    route: '/admin/waivers',
    title: 'Course Waivers',
    subtitle: 'Audit signed liability waivers across the platform.',
    steps: [
      {
        heading: 'Why this exists',
        body: 'Every student signs a per-course waiver before the class. Pull a waiver here when supporting an incident report or legal request.',
      },
      {
        heading: 'What you see',
        body: 'Signed name, IP, timestamp, course, and the exact waiver text version they accepted. Download as PDF for legal hand-off.',
      },
    ],
  },
  {
    id: 'course-editor',
    route: '/admin/course-editor',
    title: 'Force-Edit Courses',
    subtitle: 'Edit any course as if you were the instructor.',
    steps: [
      {
        heading: 'Use sparingly',
        body: 'This bypasses the instructor. Reserve for typos, illegal content removal, or compliance fixes. Every edit is logged with your admin id.',
      },
      {
        heading: 'Always notify',
        body: 'Message the instructor after any force-edit so they know what changed and why.',
      },
    ],
  },
  {
    id: 'featured',
    route: '/admin/featured',
    title: 'Featured Courses',
    subtitle: 'Curate the courses that appear on Discover.',
    steps: [
      {
        heading: 'How featuring works',
        body: 'Featured courses appear at the top of Discover and in marketing surfaces. Drag to reorder, toggle visibility per region.',
      },
      {
        heading: 'Rotate regularly',
        body: 'Featuring is a finite resource. Rotate weekly so different instructors get exposure and metrics stay meaningful.',
      },
    ],
  },
  {
    id: 'conversations',
    route: '/admin/conversations',
    title: 'Conversations',
    subtitle: 'Read any DM thread between students and instructors.',
    steps: [
      {
        heading: 'Read-only by default',
        body: 'Open a thread to see the full message history with timestamps. Use this when investigating a complaint or refund dispute.',
      },
      {
        heading: 'Off-platform contact attempts',
        body: 'The redaction system flags attempts to share phone/email to dodge fees. Look for ⚠ markers — they are bookings worth auditing.',
      },
    ],
  },
  {
    id: 'moderation',
    route: '/admin/moderation',
    title: 'AI Moderation',
    subtitle: 'Queue of content the AI flagged for human review.',
    steps: [
      {
        heading: 'Triage the queue',
        body: 'Each row is content (review, message, course copy) the AI flagged. Approve, reject + delete, or escalate with a note.',
      },
      {
        heading: 'Tune the model',
        body: 'When you reject a flag as a false positive, that decision feeds back into the moderation rules — the queue shrinks over time.',
      },
    ],
  },
  {
    id: 'deposit-review',
    route: '/admin/deposit-review',
    title: 'Deposit Review',
    subtitle: 'Resolve bookings whose deposit hold is stuck.',
    steps: [
      {
        heading: 'What "stuck" means',
        body: 'A deposit is awaiting confirmation past its expiry — usually a Helcim webhook never landed. Each row gives you the booking + the original Helcim ref.',
      },
      {
        heading: 'Two outcomes',
        body: 'Either confirm the deposit (if the student actually attended) or release it back to the card. Always paste the Helcim transaction ID into the note field.',
        tip: 'The badge on the sidebar shows the live count of stuck deposits — clear it daily.',
      },
    ],
  },
  {
    id: 'financials',
    route: '/admin/financials',
    title: 'Financials',
    subtitle: 'Revenue, payouts, refunds, and platform margin over time.',
    steps: [
      {
        heading: 'Top KPIs',
        body: 'Gross revenue, net revenue (after refunds + Helcim transfer fees), and active payouts owed. Filter by date range.',
      },
      {
        heading: 'Reconcile monthly',
        body: 'Export the monthly CSV and reconcile against your Helcim and bank statements before close-of-month.',
      },
    ],
  },
  {
    id: 'fee-overrides',
    route: '/admin/fee-overrides',
    title: 'Fee Overrides',
    subtitle: 'Per-instructor or per-course overrides to default fees.',
    steps: [
      {
        heading: 'When to override',
        body: 'Special partnership pricing (e.g. a flagship instructor on 0% listing fee for 90 days). Always set an expiry so the override does not become permanent.',
      },
      {
        heading: 'Audit trail',
        body: 'Every override records who set it, why, and when it expires. Review the list quarterly to remove stale ones.',
      },
    ],
  },
  {
    id: 'refunds',
    route: '/admin/refunds',
    title: 'Refund Credits',
    subtitle: 'Manual goodwill credits and refund overrides.',
    steps: [
      {
        heading: 'Standard refunds happen automatically',
        body: 'The cancellation policy issues refunds without you. This tab is for *exceptions*: weather refunds, comp credits, partial goodwill.',
      },
      {
        heading: 'Issuing a credit',
        body: 'Pick the user, the amount, the reason category, and a free-text note. The credit appears in their wallet immediately and on their next checkout.',
        tip: 'Always pick a reason category — financials reports group by it.',
      },
    ],
  },
  {
    id: 'bug-triage',
    route: '/admin/bug-triage',
    title: 'Bug Triage AI',
    subtitle: 'AI-clustered user-reported bugs ranked by impact.',
    steps: [
      {
        heading: 'How clustering works',
        body: 'Reports with similar stack traces or descriptions are grouped. The cluster header shows "users affected" so you can prioritize by reach, not noise.',
      },
      {
        heading: 'Resolving a cluster',
        body: 'Mark fixed → linked reporters get a notification. Mark wont-fix → polite explanation auto-sent. Always pick one before closing.',
      },
    ],
  },
  {
    id: 'reliability',
    route: '/admin/reliability',
    title: 'Reliability',
    subtitle: 'Error rates, slow queries, and edge function health.',
    steps: [
      {
        heading: 'Read the graphs',
        body: 'Error rate, P95 latency, and edge function invocations over the last 24h / 7d / 30d. Spikes correlate with deploys — overlay deploy markers.',
      },
      {
        heading: 'When to act',
        body: 'P95 > 2s for any auth or checkout route is a "drop everything" event. Everything else, file in Bug Triage.',
      },
    ],
  },
  {
    id: 'reports',
    route: '/admin/reports',
    title: 'Issue Reports',
    subtitle: 'User-submitted bug & feedback reports.',
    steps: [
      {
        heading: 'Triage flow',
        body: 'Read → tag (bug, feature, content) → assign severity → reply or close. Replies email the reporter directly.',
      },
      {
        heading: 'Bridge to engineering',
        body: 'Promote anything reproducible into Bug Triage AI so it joins clusters and gets impact-ranked.',
      },
    ],
  },
  {
    id: 'support',
    route: '/admin/support',
    title: 'Support Tickets',
    subtitle: 'Direct help requests from students and instructors.',
    steps: [
      {
        heading: 'SLA',
        body: 'First response within 24h. Tickets older than that turn red — clear them first.',
      },
      {
        heading: 'Common resolutions',
        body: 'Most tickets are refunds, password resets, or "I cannot find my booking". Use the canned-response shortcuts and link out to Help Center articles.',
      },
    ],
  },
  {
    id: 'activity',
    route: '/admin/activity',
    title: 'Audit Log',
    subtitle: 'Append-only record of every admin action.',
    steps: [
      {
        heading: 'Why this matters',
        body: 'Every suspension, refund, force-edit, and impersonation lands here with admin id, timestamp, and reason. This is your defense in any dispute.',
      },
      {
        heading: 'Searching',
        body: 'Filter by admin, action type, target user, or date range. Export to CSV for compliance audits.',
      },
    ],
  },
  {
    id: 'flags',
    route: '/admin/flags',
    title: 'Feature Flags',
    subtitle: 'Toggle experimental features on/off without a deploy.',
    steps: [
      {
        heading: 'Flag types',
        body: 'Boolean (on/off), percentage rollout (e.g. 10% of users), and per-user allowlists for staff testing.',
        tip: 'Always start a new feature at 0% or staff-only, then ramp.',
      },
      {
        heading: 'Roll back fast',
        body: 'If a flagged feature misbehaves in prod, flip the flag here — no deploy, instant effect.',
      },
    ],
  },
  {
    id: 'test-accounts',
    route: '/admin/test-accounts',
    title: 'Fake Onboarding Test Accounts',
    subtitle: 'Spin up disposable users for QA without polluting prod metrics.',
    steps: [
      {
        heading: 'Create test users',
        body: 'Generates an account flagged "test" — excluded from financials, analytics, and email broadcasts.',
      },
      {
        heading: 'Cleanup',
        body: 'Delete from this tab when done. Test accounts auto-expire after 30 days.',
      },
    ],
  },
  {
    id: 'warrior-quotes',
    route: '/admin/warrior-quotes',
    title: 'Warrior Quotes',
    subtitle: 'Curate the rotating quote library shown across the app.',
    steps: [
      {
        heading: 'Adding a quote',
        body: 'Quote text + attribution. The system rotates them on splash, dashboard headers, and weekly emails.',
      },
      {
        heading: 'Tone guideline',
        body: 'Keep quotes about discipline, training, and resilience. Avoid politics or anything that could read as endorsing violence.',
      },
    ],
  },
  {
    id: 'security',
    route: '/admin/security',
    title: 'Security',
    subtitle: 'API keys, RLS audit, and suspicious-activity alerts.',
    steps: [
      {
        heading: 'Rotate keys here',
        body: 'Lovable AI key, Helcim webhook secret, and admin API tokens. Rotation invalidates the old key immediately — schedule outside peak hours.',
      },
      {
        heading: 'Anomaly alerts',
        body: 'Failed logins, unusual IP geographies, and admin actions from new devices. Investigate every red row.',
      },
    ],
  },
  {
    id: 'helcim-webhooks',
    route: '/admin/helcim-webhooks',
    title: 'Helcim Webhooks',
    subtitle: 'Live feed of payment events from Helcim.',
    steps: [
      {
        heading: 'What you see',
        body: 'Each webhook event Helcim sent us, with payload, our parsed result, and whether it was processed successfully.',
      },
      {
        heading: 'Replay failures',
        body: 'If a webhook errored (e.g. DB hiccup), use the Replay button. Idempotency keys ensure no double-processing.',
      },
    ],
  },
  {
    id: 'refund-test',
    route: '/admin/refund-test',
    title: 'Live Refund Test',
    subtitle: 'Issue a tiny live refund end-to-end against Helcim.',
    steps: [
      {
        heading: 'What this does',
        body: 'Runs a real $0.50 charge → refund cycle on the configured card to verify Helcim creds + webhook plumbing are live.',
      },
      {
        heading: 'When to use',
        body: 'After rotating Helcim keys, after deploys touching payments, and weekly as a smoke test.',
      },
    ],
  },
  {
    id: 'uptime',
    route: '/admin/uptime',
    title: 'Uptime & Domains',
    subtitle: 'Domain status, SSL expiry, and synthetic uptime checks.',
    steps: [
      {
        heading: 'Read the indicators',
        body: 'Green = healthy in the last 5 min. Yellow = degraded latency. Red = at least one synthetic check failed.',
      },
      {
        heading: 'SSL & DNS',
        body: 'Shows days until cert expiry and current DNS records. Renewals auto-trigger 30 days out — investigate if a domain ever shows < 7 days.',
      },
    ],
  },
  {
    id: 'settings',
    route: '/admin/settings',
    title: 'Platform Settings',
    subtitle: 'Global defaults — fees, limits, copy.',
    steps: [
      {
        heading: 'Global defaults',
        body: 'Default platform fee, default listing fee %, default cancellation grace tiers. Changes here affect every new booking from now on (existing ones grandfather to their original terms).',
      },
      {
        heading: 'Be careful',
        body: 'Settings here override product defaults. Document every change in the team channel and the Audit Log will record who/when.',
      },
    ],
  },
  {
    id: 'cockpit',
    route: '/admin/cockpit',
    title: 'Owner Cockpit',
    subtitle: 'Mission-control view of the levers reserved for the owner.',
    steps: [
      {
        heading: 'What lives here',
        body: 'Same surface as Owner Console — prelaunch toggles, AI features, payment failover. The "cockpit" alias exists for muscle memory if you came from an older nav.',
        tip: 'Treat every switch as production-impacting — read the description before flipping.',
      },
      {
        heading: 'When to open it',
        body: 'During launches, incidents, or pricing experiments. For day-to-day moderation use the dedicated tabs instead.',
      },
    ],
  },
  {
    id: 'brief',
    route: '/admin/brief',
    title: 'Weekly Brief',
    subtitle: 'A one-page summary of the platform week — read this every Monday.',
    steps: [
      {
        heading: 'What you get',
        body: 'Week-over-week deltas on signups, bookings, revenue, refunds, and support load — auto-compiled so you do not have to assemble it.',
        bullets: [
          { label: 'Highlights', text: 'Biggest wins and biggest losses, with links to the source tab.' },
          { label: 'Risks', text: 'Stuck deposits, rising refund rate, slow P95, or instructor churn signals.' },
          { label: 'Next actions', text: 'Suggested follow-ups based on what trended.' },
        ],
      },
      {
        heading: 'Use it as a standup',
        body: 'Skim every Monday before opening any other tab. It tells you where to spend your week.',
      },
    ],
  },
  {
    id: 'feedback',
    route: '/admin/feedback',
    title: 'User Feedback',
    subtitle: 'Free-text feedback submitted in-app by students and instructors.',
    steps: [
      {
        heading: 'Why this is separate from Reports',
        body: 'Reports are bugs and concrete issues. Feedback is opinions, feature requests, and qualitative input — useful for product direction, not for triage.',
      },
      {
        heading: 'Tag and route',
        body: 'Tag each entry (UX, pricing, feature request, praise) and archive once captured. High-signal items get promoted into the roadmap.',
        tip: 'Reply to anyone who left their email — even one sentence — they remember it.',
      },
    ],
  },
  {
    id: 'background-videos',
    route: '/admin/background-videos',
    title: 'Background Videos',
    subtitle: 'Manage the splash and hero background video library.',
    steps: [
      {
        heading: 'Upload and activate',
        body: 'Upload a new MP4, mark it active, and the splash + hero surfaces start rotating it in. Inactive videos stay archived but can be re-enabled.',
        bullets: [
          { label: 'Spec', text: 'H.264 MP4, < 8 MB, 1080p or smaller, no audio.' },
          { label: 'Tone', text: 'Training / discipline / outdoor. Avoid anything overtly violent.' },
        ],
      },
      {
        heading: 'Test on mobile',
        body: 'Some clips look great on desktop but render too dark on phones. Always preview on a phone before activating.',
      },
    ],
  },
  {
    id: 'subscription-plans',
    route: '/admin/subscription-plans',
    title: 'Subscription Plans',
    subtitle: 'Manage the instructor subscription tiers and pricing.',
    steps: [
      {
        heading: 'What you can edit',
        body: 'Plan name, monthly price, included features, and visibility. Existing subscribers stay on the price they signed up at — edits affect new subscribers only.',
      },
      {
        heading: 'Be deliberate',
        body: 'Pricing changes are visible to all instructors immediately. Coordinate with marketing/comms before publishing a new tier.',
        tip: 'Use Feature Flags to A/B test a price point before making it the default.',
      },
    ],
  },
  {
    id: 'founding-instructors',
    route: '/admin/founding-instructors',
    title: 'Founding Instructors',
    subtitle: 'Curate the Founding Instructor program — limited badge + perks.',
    steps: [
      {
        heading: 'Who qualifies',
        body: 'Approved instructors invited before the public launch, or hand-picked partners. The badge is finite — once the slot count is hit, no more can be added without raising the cap.',
      },
      {
        heading: 'Adding & revoking',
        body: 'Add by user id with a short reason. Revoke only for cause (policy violation, departure) — the badge is visible to students and revocation is auditable.',
      },
    ],
  },
  {
    id: 'seo',
    route: '/admin/seo',
    title: 'SEO & Articles',
    subtitle: 'Step-by-step guide to writing, illustrating, and publishing an article — GIFs included.',
    steps: [
      {
        heading: 'Step 1 — Pick a topic with the AI assistant',
        body: 'Open the Topics tab. In the "AI topic assistant" card type a rough idea (e.g. "concealed carry for new shooters in Texas") and hit Suggest angles. The assistant returns 3 cards, each with a title, primary keyword, secondary keywords, "People Also Ask" questions, and a unique angle.',
        bullets: [
          { label: 'Seed input', text: 'One short sentence is enough — location and notes are optional.' },
          { label: 'Apply', text: 'Tap "Use this angle" on the card you like — it auto-fills the article form below.' },
        ],
        tip: 'Generate twice if nothing fits — the model returns different angles each call.',
      },
      {
        heading: 'Step 2 — Draft the article',
        body: 'Fill in title, slug, primary keyword, meta description, and body. The slug auto-suggests from the title; the meta description should be 140-160 chars so search engines show it whole.',
        bullets: [
          { label: 'Headings', text: 'One H1 (the title), then H2 for sections, H3 for sub-points. Keep the keyword in the first H2.' },
          { label: 'Length', text: '900-1500 words ranks best for our category — shorter for news, longer for guides.' },
          { label: 'Internal links', text: 'Link to at least one course page and one other article — boosts authority and dwell time.' },
        ],
        tip: 'Use the "Generate draft" button if you want the AI to write a first pass from the chosen angle — always edit before publishing.',
      },
      {
        heading: 'Step 3 — Add a cover image',
        body: 'Every article needs a cover. Upload a 1600×900 JPG or PNG via the cover image picker. Add alt text that includes the primary keyword — this is what screen readers and Google Images read.',
        tip: 'Photos of real training scenes beat stock photos for click-through. Avoid anything that reads as staged.',
      },
      {
        heading: 'Step 4 — Insert images and GIFs into the body',
        body: 'Inside the body editor, place the cursor where you want the asset and click the image / GIF button in the toolbar. You have three sources:',
        bullets: [
          { label: 'Upload', text: 'Drag a .jpg, .png, .webp, or .gif from your desktop (max 5 MB). GIFs stay animated — do not re-encode them.' },
          { label: 'GIF search', text: 'Type a query in the GIF picker to search the built-in library. Click to insert.' },
          { label: 'Paste URL', text: 'For GIFs hosted elsewhere (Giphy, Tenor) paste the direct .gif URL — the editor embeds it inline.' },
        ],
        tip: 'Keep GIFs under 3 MB and 1 per section. Big or stacked GIFs tank mobile load time and hurt rankings.',
      },
      {
        heading: 'Step 5 — Caption, alt, and accessibility',
        body: 'After inserting an image or GIF, click it to open the asset panel. Fill in alt text (required) and an optional caption. Alt text describes the image for screen readers AND for Google Images — write a real sentence, not the file name.',
        bullets: [
          { label: 'Good alt', text: '"Instructor demonstrating a low-ready stance during a CCW class."' },
          { label: 'Bad alt', text: '"IMG_2381.gif"' },
        ],
      },
      {
        heading: 'Step 6 — Preview, then publish',
        body: 'Hit Preview to see the article exactly as readers will. Check mobile preview too — long GIFs and wide tables are the usual offenders. When it looks right, set status to Published and pick a publish date.',
        bullets: [
          { label: 'Schedule', text: 'Pick a future date/time to auto-publish — useful for coordinating with launches.' },
          { label: 'Unpublish', text: 'You can flip status back to Draft anytime — the URL keeps working with a noindex tag.' },
        ],
        tip: 'After publishing, paste the URL into the AI Search tab to verify it gets crawled and indexed within 24-48 hours.',
      },
      {
        heading: 'Step 7 — Re-open this guide anytime',
        body: 'The "Crash Course" button stays pinned in the bottom-left of this tab. Tap it whenever you want to walk through the article flow again.',
      },
    ],
  },
];

export function resolveCrashCourse(pathname: string): CrashCourse | null {
  // Exact matches first (e.g. /admin)
  const exact = CRASH_COURSES.find((c) => c.exact && c.route === pathname);
  if (exact) return exact;
  // Otherwise longest prefix match
  const matches = CRASH_COURSES
    .filter((c) => !c.exact && pathname.startsWith(c.route))
    .sort((a, b) => b.route.length - a.route.length);
  return matches[0] ?? null;
}
