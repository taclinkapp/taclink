import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crosshair, GraduationCap, Shield, ShieldCheck, X, Settings2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * DevRoleSwitcher
 * --------------------------------------------------------------------------
 * DEV-ONLY floating panel to jump between Student / Instructor / Admin
 * portals using real Supabase sessions, so RLS-protected data loads.
 *
 * Backed by seeded auth users (see migration 20260428170000_dev_seed_users.sql):
 *   student@dev.taclink.local
 *   instructor@dev.taclink.local
 *   admin@dev.taclink.local
 *   password: DevPass123!
 *
 * Visible ONLY when `import.meta.env.DEV` is true (stripped from prod builds).
 * Remove before shipping to production.
 */

type Role = 'student' | 'instructor' | 'admin';

const credentials: Record<Role, { email: string; password: string }> = {
  student: { email: 'student@dev.taclink.local', password: 'DevPass123!' },
  instructor: { email: 'instructor@dev.taclink.local', password: 'DevPass123!' },
  admin: { email: 'admin@dev.taclink.local', password: 'DevPass123!' },
};

const destinations: Record<Role, string> = {
  student: '/student',
  instructor: '/instructor',
  admin: '/admin',
};

export const DevRoleSwitcher = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Role | null>(null);

  const enter = async (role: Role) => {
    if (busy) return;
    setBusy(role);
    try {
      // Sign out any existing session first so role/profile state refreshes cleanly
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword(credentials[role]);
      if (error) {
        toast.error(`Dev sign-in failed: ${error.message}`);
        return;
      }
      // Keep legacy localStorage shim so messaging fallback still resolves a name
      localStorage.setItem(
        'taclink:devUser',
        JSON.stringify({
          id: `dev-${role}`,
          name: `Dev ${role[0].toUpperCase()}${role.slice(1)}`,
          role,
          email: credentials[role].email,
        }),
      );
      navigate(destinations[role]);
      setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  const clear = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('taclink:devUser');
    navigate('/');
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[100] font-sans">
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

          <RoleButton
            icon={GraduationCap}
            label="Enter as Student"
            loading={busy === 'student'}
            onClick={() => enter('student')}
          />
          <RoleButton
            icon={Shield}
            label="Enter as Instructor"
            loading={busy === 'instructor'}
            onClick={() => enter('instructor')}
          />
          <RoleButton
            icon={ShieldCheck}
            label="Enter as Admin"
            loading={busy === 'admin'}
            onClick={() => enter('admin')}
          />

          <button
            type="button"
            onClick={clear}
            className="w-full text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground hover:text-destructive py-2"
          >
            Sign out & back to splash
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
  loading,
  onClick,
}: {
  icon: typeof Crosshair;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="w-full neu-sm flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-bold text-foreground hover:text-primary transition-colors disabled:opacity-60"
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Icon className="h-4 w-4 text-primary" />}
    {label}
  </button>
);
