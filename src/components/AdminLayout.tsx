import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Shield, BookOpen, Mail, MessageSquare, ScrollText, Settings, LogOut, Bug, LifeBuoy, ShieldAlert, DollarSign, Wallet, ToggleLeft, TrendingUp, Star, Sparkles, Edit3, Percent, Menu, X, Megaphone, FlaskConical, Sword, KeyRound, Webhook } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AdminAIPanel } from '@/components/admin/AdminAIPanel';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Item = {
  to: string;
  icon: any;
  label: string;
  end?: boolean;
  badgeKey?: 'stuckDeposits';
};

const items: Item[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/owner-console', icon: Sparkles, label: 'Owner Console' },
  { to: '/admin/influencers', icon: Megaphone, label: 'Influencer Links' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/instructors', icon: Shield, label: 'Instructors' },
  { to: '/admin/courses', icon: BookOpen, label: 'Courses' },
  { to: '/admin/course-editor', icon: Edit3, label: 'Force-Edit Courses' },
  { to: '/admin/featured', icon: Star, label: 'Featured Courses' },
  { to: '/admin/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/admin/moderation', icon: ShieldAlert, label: 'AI Moderation' },
  { to: '/admin/deposit-review', icon: Wallet, label: 'Deposit Review', badgeKey: 'stuckDeposits' },
  { to: '/admin/financials', icon: TrendingUp, label: 'Financials' },
  { to: '/admin/fee-overrides', icon: Percent, label: 'Fee Overrides' },
  { to: '/admin/refunds', icon: DollarSign, label: 'Refund Credits' },
  { to: '/admin/bug-triage', icon: Sparkles, label: 'Bug Triage AI' },
  { to: '/admin/waitlist', icon: Mail, label: 'Waitlist' },
  { to: '/admin/reports', icon: Bug, label: 'Issue Reports' },
  { to: '/admin/support', icon: LifeBuoy, label: 'Support Tickets' },
  { to: '/admin/activity', icon: ScrollText, label: 'Audit Log' },
  { to: '/admin/flags', icon: ToggleLeft, label: 'Feature Flags' },
  { to: '/admin/test-accounts', icon: FlaskConical, label: 'Fake Onboarding Testing Accounts' },
  { to: '/admin/warrior-quotes', icon: Sword, label: 'Warrior Quotes' },
  { to: '/admin/security', icon: KeyRound, label: 'Security' },
  { to: '/admin/helcim-webhooks', icon: Webhook, label: 'Helcim Webhooks' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export const AdminLayout = () => {
  const nav = useNavigate();
  const location = useLocation();
  const [stuckDeposits, setStuckDeposits] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const refreshBadges = async () => {
    // Stuck = awaiting_confirmation past expiry window.
    const { data } = await supabase
      .from('bookings')
      .select('id, deposit_expires_at')
      .eq('deposit_status', 'awaiting_confirmation')
      .lt('deposit_expires_at', new Date().toISOString());
    setStuckDeposits((data ?? []).length);
  };

  useEffect(() => {
    refreshBadges();
    const id = setInterval(refreshBadges, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close drawer on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const counts = { stuckDeposits };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 z-40 bg-sidebar border-b border-sidebar-border flex items-center px-3 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="h-10 w-10 rounded-md flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label="Open admin menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo showTagline className="h-7 w-auto" />
        <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Admin</div>
        {stuckDeposits > 0 && (
          <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            {stuckDeposits > 99 ? '99+' : stuckDeposits}
          </span>
        )}
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="p-5 border-b border-sidebar-border flex items-start justify-between">
          <div>
            <Logo showTagline widthPx={120} />
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mt-2">Admin Panel</div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden h-8 w-8 rounded-md flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((it) => {
            const badge = it.badgeKey ? counts[it.badgeKey] : 0;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 h-10 rounded-md text-sm font-semibold transition',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent',
                  )
                }
              >
                <it.icon className="h-4 w-4" />
                <span className="flex-1">{it.label}</span>
                {badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button onClick={() => nav('/')} className="w-full flex items-center gap-3 px-3 h-10 rounded-md text-sm font-semibold text-destructive hover:bg-destructive/10">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 min-w-0">
        <Outlet />
      </main>
      <AdminAIPanel />
    </div>
  );
};
