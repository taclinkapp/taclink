import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crosshair, GraduationCap, Shield, ShieldCheck, X, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * DevRoleSwitcher
 * --------------------------------------------------------------------------
 * Floating dev-only panel to jump straight into Student / Instructor / Admin
 * views, skipping splash + onboarding while building the prototype.
 *
 * - Visible ONLY when `import.meta.env.DEV` is true (stripped from prod builds).
 * - Stores a mock "logged in" user in localStorage so future auth-aware
 *   screens can pick up a role without a real session.
 */

type Role = 'student' | 'instructor' | 'admin';

const mockUsers: Record<Role, { id: string; name: string; role: Role; email: string }> = {
  student: { id: 'dev-student', name: 'Dev Student', role: 'student', email: 'student@dev.local' },
  instructor: { id: 'dev-instructor', name: 'Dev Instructor', role: 'instructor', email: 'instructor@dev.local' },
  admin: { id: 'dev-admin', name: 'Dev Admin', role: 'admin', email: 'admin@dev.local' },
};

const destinations: Record<Role, string> = {
  student: '/student',
  instructor: '/instructor',
  admin: '/admin',
};

export const DevRoleSwitcher = () => {
  if (!import.meta.env.DEV) return null;

  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const enter = (role: Role) => {
    localStorage.setItem('taclink:devUser', JSON.stringify(mockUsers[role]));
    navigate(destinations[role]);
    setOpen(false);
  };

  const clear = () => {
    localStorage.removeItem('taclink:devUser');
    navigate('/');
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] font-sans">
      {open ? (
        <div className="neu w-64 p-3 space-y-2">
          <div className="flex items-center justify-between px-1 pb-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
              <Crosshair className="h-3.5 w-3.5" /> Dev Switcher
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <RoleButton icon={GraduationCap} label="Enter as Student" onClick={() => enter('student')} />
          <RoleButton icon={Shield} label="Enter as Instructor" onClick={() => enter('instructor')} />
          <RoleButton icon={ShieldCheck} label="Enter as Admin" onClick={() => enter('admin')} />

          <button
            type="button"
            onClick={clear}
            className="w-full text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground hover:text-destructive py-2"
          >
            Reset & back to splash
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open dev role switcher"
          className={cn(
            'h-12 w-12 rounded-full neu flex items-center justify-center text-primary',
            'hover:scale-105 transition-transform',
          )}
        >
          <Settings2 className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

const RoleButton = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Crosshair;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full neu-sm flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-bold text-foreground hover:text-primary transition-colors"
  >
    <Icon className="h-4 w-4 text-primary" />
    {label}
  </button>
);
