import { NavLink, useLocation } from 'react-router-dom';
import { Compass, CalendarCheck, TrendingUp, MessageSquare, Star, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/student', icon: Compass, label: 'Discover', end: true },
  { to: '/student/bookings', icon: CalendarCheck, label: 'Bookings' },
  { to: '/student/progress', icon: TrendingUp, label: 'Progress' },
  { to: '/student/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/student/reviews', icon: Star, label: 'Reviews' },
  { to: '/student/profile', icon: User, label: 'Profile' },
];

export const StudentTabBar = () => {
  const { pathname } = useLocation();
  // Hide on certain routes
  if (pathname.includes('/booking-success') || pathname.includes('/checkout')) return null;
  return (
    <nav className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
      <div className="max-w-md mx-auto neu rounded-full pointer-events-auto">
        <div className="grid grid-cols-6 px-2 py-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2 rounded-full text-[10px] uppercase tracking-wider font-bold transition-all',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('h-9 w-9 rounded-full flex items-center justify-center', isActive ? 'neu-sm text-primary' : '')}>
                    <t.icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};
