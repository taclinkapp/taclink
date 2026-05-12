import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { GraduationCap, Search, CalendarCheck, MessageSquare, ShieldCheck, Plus, Users, DollarSign, Sparkles, X } from 'lucide-react';

type Role = 'student' | 'instructor';

interface Slide {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

const STUDENT_SLIDES: Slide[] = [
  { icon: GraduationCap, title: 'Welcome to TacLink', body: "You're in the field manual now. This 60-second tour shows you how to find training, book a seat, and stay connected with your instructor." },
  { icon: Search, title: 'Discover courses', body: 'Browse by discipline, location, or map view. Tap any course to see the instructor, what to bring, and the safety waiver.' },
  { icon: CalendarCheck, title: 'Book and check in', body: 'Reserve your seat, e-sign the waiver, and pay securely. Your booking is held in escrow and only released after the course runs.' },
  { icon: MessageSquare, title: 'Stay in touch', body: 'Message your instructor directly from your booking, leave a review afterward, and earn punches toward perks. Welcome aboard.' },
];

const INSTRUCTOR_SLIDES: Slide[] = [
  { icon: ShieldCheck, title: 'Welcome, Instructor', body: "Let's take 60 seconds to walk through how TacLink helps you publish courses, take bookings, and get paid." },
  { icon: Plus, title: 'Build your course', body: 'Create a course with photos of your range and gear, set your price, and add a waiver. Pro subscribers can AI-generate waivers tailored to each course.' },
  { icon: Users, title: 'Manage your roster', body: 'Track seats, message students, and check them in with QR scan on the day of training. Attendance unlocks payout.' },
  { icon: DollarSign, title: 'Get paid securely', body: 'Funds sit in escrow during booking and release to your linked payout account after the course. Insights show what students search for in your area.' },
];

export function CrashCourseTour({ role, open, onClose }: { role: Role; open: boolean; onClose: () => void }) {
  const slides = role === 'instructor' ? INSTRUCTOR_SLIDES : STUDENT_SLIDES;
  const [i, setI] = useState(0);

  useEffect(() => { if (open) setI(0); }, [open]);

  const slide = slides[i];
  const Icon = slide.icon;
  const isLast = i === slides.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center mb-2">
            <Icon className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-lg">{slide.title}</DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed pt-1">
            {slide.body}
          </DialogDescription>
        </DialogHeader>

        <div className="px-1 pt-2">
          <Progress value={((i + 1) / slides.length) * 100} className="h-1.5" />
          <div className="text-[11px] text-muted-foreground text-center mt-1.5">
            Step {i + 1} of {slides.length}
          </div>
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            <X className="h-3.5 w-3.5 mr-1" /> Skip
          </Button>
          <div className="flex gap-2">
            {i > 0 && (
              <Button variant="outline" size="sm" onClick={() => setI(i - 1)}>Back</Button>
            )}
            <Button size="sm" onClick={() => (isLast ? onClose() : setI(i + 1))} className="bg-primary text-primary-foreground">
              {isLast ? 'Get started' : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const tourKey = (role: Role, userId: string | undefined) => `taclink_tour_seen:${role}:${userId ?? 'anon'}`;
const pendingTourKey = (role: Role, userId: string | undefined) => `taclink_tour_pending:${role}:${userId ?? 'anon'}`;
const signupPendingTourKey = (role: Role) => `taclink_tour_pending_signup:${role}`;

export function requestCrashCourseTour(role: Role, userId?: string | undefined) {
  try {
    if (userId) sessionStorage.setItem(pendingTourKey(role, userId), '1');
    // userId-less flag so the tour also fires on the first dashboard mount
    // right after signup, before AuthContext finishes hydrating.
    sessionStorage.setItem(signupPendingTourKey(role), '1');
  } catch { /* ignore */ }
}

export function useCrashCourseTour(
  role: Role,
  userId: string | undefined,
  { autoOpen = true }: { autoOpen?: boolean } = {},
) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const pendingKey = pendingTourKey(role, userId);
    const signupKey = signupPendingTourKey(role);
    const isPending =
      sessionStorage.getItem(pendingKey) !== null ||
      sessionStorage.getItem(signupKey) !== null;
    // Only auto-open right after a signup. Regular sign-ins never trigger it.
    if (!autoOpen || !isPending) return;
    try {
      sessionStorage.removeItem(pendingKey);
      sessionStorage.removeItem(signupKey);
      localStorage.setItem(tourKey(role, userId), '1');
    } catch { /* ignore */ }
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, [autoOpen, role, userId]);

  const close = () => {
    if (userId) localStorage.setItem(tourKey(role, userId), '1');
    setOpen(false);
  };

  const replay = () => setOpen(true);

  return { open, close, replay };
}
