import { NavLink } from 'react-router-dom';
import { LayoutGrid, ListChecks, MessageSquare, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/instructor', icon: LayoutGrid, label: 'Dashboard', end: true },
  { to: '/instructor/courses', icon: ListChecks, label: 'Courses' },
  { to: '/instructor/roster', icon: Users, label: 'Roster' },
  { to: '/instructor/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/instructor/profile', icon: User, label: 'Profile' },
];

export const InstructorTabBar = () => (
  <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border">
    <div className="max-w-md mx-auto grid grid-cols-5">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-wider font-semibold transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          <t.icon className="h-5 w-5" strokeWidth={2.25} />
          {t.label}
        </NavLink>
      ))}
    </div>
  </nav>
);
