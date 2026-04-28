import { NavLink, useLocation } from 'react-router-dom';
import { Compass, CalendarCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/student', icon: Compass, label: 'Discover', end: true },
  { to: '/student/bookings', icon: CalendarCheck, label: 'Bookings' },
  { to: '/student/profile', icon: User, label: 'Profile' },
];

export const StudentTabBar = () => {
  const { pathname } = useLocation();
  // Hide on certain routes
  if (pathname.includes('/booking-success') || pathname.includes('/checkout')) return null;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border">
      <div className="max-w-md mx-auto grid grid-cols-3">
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
};
