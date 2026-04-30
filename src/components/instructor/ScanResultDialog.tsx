import { CheckCircle2, AlertTriangle, Info, ShieldAlert, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export type ScanOutcome =
  | { kind: 'success'; bookingId: string; studentName?: string | null; source: 'qr' | 'proximity' }
  | { kind: 'already_attended'; bookingId?: string; studentName?: string | null }
  | { kind: 'wrong_course'; bookingId?: string }
  | { kind: 'invalid_qr'; reason: string }
  | { kind: 'verification_failed'; reason: string }
  | { kind: 'unsigned_warning'; bookingId?: string; studentName?: string | null }
  | { kind: 'pending_proximity'; bookingId: string; studentName?: string | null }
  | { kind: 'cannot_checkin'; bookingId: string; status: string }
  | { kind: 'rpc_error'; bookingId?: string; reason: string };

type Props = {
  outcome: ScanOutcome | null;
  onScanAnother: () => void;
  onClose: () => void;
};

type Tone = 'success' | 'warn' | 'error' | 'info';

const toneStyles: Record<Tone, { wrap: string; icon: string; Icon: typeof CheckCircle2 }> = {
  success: { wrap: 'border-success/40 bg-success/5', icon: 'text-success', Icon: CheckCircle2 },
  warn:    { wrap: 'border-amber-500/40 bg-amber-500/5', icon: 'text-amber-500', Icon: AlertTriangle },
  error:   { wrap: 'border-destructive/40 bg-destructive/5', icon: 'text-destructive', Icon: ShieldAlert },
  info:    { wrap: 'border-primary/40 bg-primary/5', icon: 'text-primary', Icon: Info },
};

const describe = (o: ScanOutcome): { tone: Tone; title: string; body: string; primaryLabel: string } => {
  const who = (n?: string | null) => (n ? n : 'Student');
  switch (o.kind) {
    case 'success':
      return {
        tone: 'success',
        title: o.source === 'proximity' ? 'Auto check-in confirmed' : 'Checked in',
        body: `${who(o.studentName)} is checked in for this course.${
          o.source === 'proximity' ? ' Proximity + signed QR both confirmed.' : ''
        }`,
        primaryLabel: 'Scan next student',
      };
    case 'already_attended':
      return {
        tone: 'info',
        title: 'Already checked in',
        body: `${who(o.studentName)} was already checked in for this course. No second check-in is needed — their escrow is on track for release.`,
        primaryLabel: 'Scan next student',
      };
    case 'pending_proximity':
      return {
        tone: 'info',
        title: 'QR verified — waiting for proximity',
        body: `${who(o.studentName)}'s QR is valid. Stay near the venue (within ~10 ft) to auto-confirm. Or turn off auto check-in to confirm now.`,
        primaryLabel: 'Scan another',
      };
    case 'unsigned_warning':
      return {
        tone: 'warn',
        title: 'Unsigned QR — limited trust',
        body: `${who(o.studentName)}'s QR is from an older format. Ask them to refresh their booking page so a freshly signed QR is generated. You can still proceed but signed QRs are preferred.`,
        primaryLabel: 'Scan again with new QR',
      };
    case 'wrong_course':
      return {
        tone: 'error',
        title: 'Wrong course',
        body: 'This QR belongs to a different course. Make sure the student is on the right booking, then have them refresh and re-show the QR.',
        primaryLabel: 'Try again',
      };
    case 'invalid_qr':
      return {
        tone: 'error',
        title: 'Not a TacLink check-in QR',
        body: o.reason || 'The scanned code is not recognized. Have the student open their booking and tap "Refresh QR".',
        primaryLabel: 'Try again',
      };
    case 'verification_failed':
      return {
        tone: 'error',
        title: 'QR could not be verified',
        body: `${o.reason}. Ask the student to refresh their booking page to get a fresh signed QR.`,
        primaryLabel: 'Try again',
      };
    case 'cannot_checkin':
      return {
        tone: 'error',
        title: `Booking is ${o.status}`,
        body: 'You cannot check this student in because their booking is no longer active. Cancelled or no-show bookings cannot be reverted via QR.',
        primaryLabel: 'Scan another',
      };
    case 'rpc_error':
      return {
        tone: 'error',
        title: 'Check-in failed',
        body: `${o.reason || 'Something went wrong.'} Try again — if the problem persists, mark attendance manually from the roster.`,
        primaryLabel: 'Retry scan',
      };
  }
};

export const ScanResultDialog = ({ outcome, onScanAnother, onClose }: Props) => {
  if (!outcome) return null;
  const meta = describe(outcome);
  const t = toneStyles[meta.tone];
  const Icon = t.Icon;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">{meta.title}</DialogTitle>
          <DialogDescription className="sr-only">{meta.body}</DialogDescription>
        </DialogHeader>
        <div className={`rounded-md border ${t.wrap} p-4 flex flex-col items-center text-center`}>
          <Icon className={`h-10 w-10 ${t.icon} mb-3`} strokeWidth={2.25} />
          <h3 className="font-bold text-base mb-1">{meta.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{meta.body}</p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={onScanAnother} className="w-full h-11 font-bold">
            <RotateCcw className="mr-2 h-4 w-4" />
            {meta.primaryLabel}
          </Button>
          <Button onClick={onClose} variant="outline" className="w-full h-11">
            <X className="mr-2 h-4 w-4" /> Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
