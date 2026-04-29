import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Shield, BookOpen, Mail, MessageSquare, ScrollText, Settings, LogOut, Bug, LifeBuoy, ShieldAlert, DollarSign, Wallet, ToggleLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AdminAIPanel } from '@/components/admin/AdminAIPanel';

type Item = {
  to: string;
  icon: any;
  label: string;
  end?: boolean;
  badgeKey?: 'stuckDeposits';
};

const items: Item[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/instructors', icon: Shield, label: 'Instructors' },
  { to: '/admin/courses', icon: BookOpen, label: 'Courses' },
  { to: '/admin/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/admin/moderation', icon: ShieldAlert, label: 'AI Moderation' },
  { to: '/admin/deposit-review', icon: Wallet, label: 'Deposit Review', badgeKey: 'stuckDeposits' },
  { to: '/admin/refunds', icon: DollarSign, label: 'Refunds' },
  { to: '/admin/waitlist', icon: Mail, label: 'Waitlist' },
  { to: '/admin/reports', icon: Bug, label: 'Issue Reports' },
  { to: '/admin/support', icon: LifeBuoy, label: 'Support Tickets' },
  { to: '/admin/activity', icon: ScrollText, label: 'Audit Log' },
  { to: '/admin/flags', icon: ToggleLeft, label: 'Feature Flags' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export const AdminLayout = () => {
  const nav = useNavigate();
  const location = useLocation();
  const [stuckDeposits, setStuckDeposits] = useState(0);

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
    // re-poll on route change so the badge updates after admin acts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const counts = { stuckDeposits };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <Logo size="md" />
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mt-2">Admin Panel</div>
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
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <AdminAIPanel />
    </div>
  );
};
