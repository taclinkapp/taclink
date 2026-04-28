import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { ChevronDown, Search, MessageSquare, LifeBuoy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Faq = { q: string; a: string; tags: string[] };

const FAQS: { category: string; items: Faq[] }[] = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'How do I create an account?',
        a: 'Tap **Sign Up** on the splash screen and pick **Student** or **Instructor**. Use your email or Google. Instructors complete a short credential verification step before publishing courses.',
        tags: ['account', 'signup'],
      },
      {
        q: 'Student vs Instructor — what is the difference?',
        a: 'Students discover and book courses. Instructors create and manage courses, set pricing/capacity, mark attendance, and message students. The roles are kept separate for safety and clarity.',
        tags: ['account', 'role'],
      },
      {
        q: 'How do I update my profile photo or bio?',
        a: 'Open **Profile → Edit**. Changes save instantly and appear on your bookings and messages.',
        tags: ['profile'],
      },
    ],
  },
  {
    category: 'Bookings & Courses',
    items: [
      {
        q: 'How do I book a course?',
        a: 'On the **Discover** tab, tap a course → **Book Now** → confirm details on the checkout screen. You will receive an in-app confirmation and the course will appear under **My Bookings**.',
        tags: ['booking'],
      },
      {
        q: 'Can I cancel a booking?',
        a: 'Open **My Bookings → [course] → Cancel**. Refund eligibility depends on the instructor\'s cancellation window — check the course detail page before booking.',
        tags: ['booking', 'refund'],
      },
      {
        q: 'How does the waitlist work?',
        a: 'If a course is full, tap **Join Waitlist**. You will be notified the moment a seat opens up and have a short window to claim it.',
        tags: ['booking', 'waitlist'],
      },
    ],
  },
  {
    category: 'Reviews',
    items: [
      {
        q: 'When can I leave a review?',
        a: 'Once your instructor marks you as **Attended**, the course appears under **My Reviews → Awaiting Review**. You can rate from 1–5 stars, write a comment, and attach a photo.',
        tags: ['reviews'],
      },
      {
        q: 'Why can\'t I change my star rating after submitting?',
        a: 'To keep ratings fair and trustworthy, the star rating is locked once submitted. You can still update your written comment and photo at any time.',
        tags: ['reviews'],
      },
    ],
  },
  {
    category: 'Instructors',
    items: [
      {
        q: 'How do I create my first course?',
        a: 'Open **My Courses → New Course**. Add a title, description, location, schedule, capacity, and price. Use the **AI Coach** in the bottom-right to generate curricula, gear lists, and waivers fast.',
        tags: ['instructor', 'course'],
      },
      {
        q: 'When do I get paid out?',
        a: 'Payouts are processed after a course is completed and the attendance window closes. See **Settings → Payouts** for your schedule and connected payout method.',
        tags: ['instructor', 'payout'],
      },
      {
        q: 'How do I mark attendance?',
        a: 'On the day of the course, open the course in **My Courses** and tap **Check-In**. Mark each student as Attended, No-Show, or Late. This unlocks reviews and triggers payout calculation.',
        tags: ['instructor', 'attendance'],
      },
    ],
  },
  {
    category: 'Account & Privacy',
    items: [
      {
        q: 'How do I change my password?',
        a: 'From **Settings → Account → Change Password**. You\'ll receive a confirmation email.',
        tags: ['account'],
      },
      {
        q: 'How do I delete my account?',
        a: 'Open **Settings → Delete Account**. Active bookings must be resolved first. Deletion is permanent and removes your profile, messages, and reviews.',
        tags: ['account', 'privacy'],
      },
      {
        q: 'Where can I read the Privacy Policy and Terms?',
        a: 'Both are linked under **Settings → Legal**.',
        tags: ['legal'],
      },
    ],
  },
];

const HelpCenter = () => {
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const filtered = FAQS.map((cat) => ({
    ...cat,
    items: cat.items.filter((f) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        f.q.toLowerCase().includes(q) ||
        f.a.toLowerCase().includes(q) ||
        f.tags.some((t) => t.includes(q))
      );
    }),
  })).filter((c) => c.items.length > 0);

  return (
    <MobileShell>
      <PageHeader title="Help Center" back />
      <div className="px-4 py-4 space-y-5 pb-32">
        <div className="tactical-card p-5 bg-gradient-to-br from-primary/15 via-card to-card border border-primary/20">
          <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
            <LifeBuoy className="h-3.5 w-3.5" /> 24/7 Support
          </div>
          <h2 className="text-lg font-extrabold mt-1 leading-tight">How can we help?</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Search our FAQs or chat with our AI assistant. Issues we can't solve are sent straight to a TacLink admin.
          </p>
          <Button
            onClick={() => nav('/support/contact')}
            className="w-full mt-4 bg-primary text-primary-foreground font-bold gap-2"
          >
            <MessageSquare className="h-4 w-4" /> Contact Support
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles…"
            className="pl-9 bg-card border-border"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="tactical-card p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              No articles match "<span className="font-semibold text-foreground">{query}</span>".
            </p>
            <Button onClick={() => nav('/support/contact')} variant="outline" className="bg-card">
              Ask the AI assistant
            </Button>
          </div>
        ) : (
          filtered.map((cat) => (
            <section key={cat.category}>
              <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2 px-1">
                {cat.category}
              </h3>
              <div className="tactical-card divide-y divide-border overflow-hidden">
                {cat.items.map((f) => {
                  const id = `${cat.category}::${f.q}`;
                  const isOpen = open === id;
                  return (
                    <div key={id}>
                      <button
                        onClick={() => setOpen(isOpen ? null : id)}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-muted/40"
                      >
                        <span className="text-sm font-semibold pr-3">{f.q}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
                            isOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 -mt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                          {f.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}

        <div className="tactical-card p-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Still need help?</p>
          <Button onClick={() => nav('/support/contact')} variant="outline" className="bg-card border-border font-semibold gap-2">
            <MessageSquare className="h-4 w-4" /> Contact Support
          </Button>
        </div>
      </div>
    </MobileShell>
  );
};

export default HelpCenter;
