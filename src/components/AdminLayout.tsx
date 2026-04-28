import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, BookOpen, Mail, MessageSquare, ScrollText, Settings, LogOut, Bug, LifeBuoy, ShieldAlert } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

const items = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/instructors', icon: Shield, label: 'Instructors' },
  { to: '/admin/courses', icon: BookOpen, label: 'Courses' },
  { to: '/admin/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/admin/moderation', icon: ShieldAlert, label: 'AI Moderation' },
  { to: '/admin/waitlist', icon: Mail, label: 'Waitlist' },
  { to: '/admin/reports', icon: Bug, label: 'Issue Reports' },
  { to: '/admin/support', icon: LifeBuoy, label: 'Support Tickets' },
  { to: '/admin/activity', icon: ScrollText, label: 'Activity Log' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export const AdminLayout = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <Logo size="md" />
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mt-2">Admin Panel</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((it) => (
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
              {it.label}
            </NavLink>
          ))}
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
    </div>
  );
};
