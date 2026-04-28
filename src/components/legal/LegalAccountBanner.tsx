import { GraduationCap, Shield, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type Variant = 'instructor' | 'student' | 'shared';

const config: Record<Variant, { icon: any; label: string; tint: string; border: string; text: string; accent: string }> = {
  instructor: {
    icon: GraduationCap,
    label: 'Instructor account',
    tint: 'bg-primary/10',
    border: 'border-primary/40',
    text: 'text-primary',
    accent: 'text-primary',
  },
  student: {
    icon: Users,
    label: 'Student account',
    tint: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    text: 'text-emerald-600',
    accent: 'text-emerald-600',
  },
  shared: {
    icon: Shield,
    label: 'All accounts',
    tint: 'bg-muted',
    border: 'border-border',
    text: 'text-foreground',
    accent: 'text-muted-foreground',
  },
};

export const LegalAccountBanner = ({ documentName }: { documentName: string }) => {
  const { primaryRole } = useAuth();
  const variant: Variant =
    primaryRole === 'instructor' ? 'instructor' : primaryRole === 'student' ? 'student' : 'shared';
  const c = config[variant];
  const Icon = c.icon;

  const note =
    variant === 'instructor'
      ? `These ${documentName.toLowerCase()} apply to your instructor account, including course listings, student communications, credential verification, and payouts.`
      : variant === 'student'
        ? `These ${documentName.toLowerCase()} apply to your student account, including bookings, messaging instructors, and reviews.`
        : `This document applies to both student and instructor accounts on TacLink.`;

  return (
    <div className={cn('rounded-md border p-3 flex items-start gap-3', c.tint, c.border)}>
      <div className={cn('h-9 w-9 rounded-md bg-background flex items-center justify-center shrink-0', c.text)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className={cn('text-[10px] uppercase tracking-[0.2em] font-bold', c.accent)}>
          Applies to
        </div>
        <div className="text-sm font-bold">{c.label}</div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{note}</p>
      </div>
    </div>
  );
};
