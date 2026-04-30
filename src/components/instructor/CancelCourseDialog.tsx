import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
  courseTitle: string;
  startsAt?: string | Date | null;
  onCancelled?: () => void;
}

/**
 * Final-step instructor cancellation dialog.
 *
 * Refund rule (server-enforced in instructor_cancel_course):
 *   • ≥48h before start → students fully refunded, instructor deposit released, no strike.
 *   • <48h before start → students fully refunded AND instructor forfeits deposit + 1 strike.
 */
export const CancelCourseDialog = ({
  open, onOpenChange, courseId, courseTitle, startsAt, onCancelled,
}: Props) => {
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hoursToStart = useMemo(() => {
    if (!startsAt) return null;
    const t = new Date(startsAt).getTime();
    if (Number.isNaN(t)) return null;
    return (t - Date.now()) / 3_600_000;
  }, [startsAt]);

  const isTimely = hoursToStart === null ? true : hoursToStart >= 48;

  const handleConfirm = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.rpc('instructor_cancel_course', {
      _course_id: courseId,
      _reason: reason.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Could not cancel course', { description: error.message });
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    toast.success(
      row?.was_timely
        ? `Course cancelled. ${row?.bookings_refunded ?? 0} student(s) refunded — your deposit was released.`
        : `Course cancelled. ${row?.bookings_refunded ?? 0} student(s) refunded — deposit forfeited.`,
    );
    onOpenChange(false);
    onCancelled?.();
    navigate('/instructor/dashboard');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancel "{courseTitle}"?
          </DialogTitle>
          <DialogDescription>
            All enrolled students will be fully refunded immediately. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div
          className={
            'rounded-md border p-3 text-sm ' +
            (isTimely
              ? 'border-success/40 bg-success/10 text-foreground'
              : 'border-destructive/50 bg-destructive/10 text-foreground')
          }
        >
          {isTimely ? (
            <>
              <div className="font-bold uppercase tracking-wider text-[11px] text-success mb-1">
                Timely cancellation (≥48h before start)
              </div>
              Students get a full refund and <strong>your deposit is released back to you</strong>. No strike.
            </>
          ) : (
            <>
              <div className="font-bold uppercase tracking-wider text-[11px] text-destructive mb-1">
                Late cancellation (&lt;48h before start)
              </div>
              Students get a full refund and <strong>you forfeit your deposit on every booking</strong>. A strike will be added to your account.
            </>
          )}
          {hoursToStart !== null && (
            <div className="text-[11px] text-muted-foreground mt-1">
              Course starts in {Math.max(0, Math.round(hoursToStart))} hour
              {Math.round(hoursToStart) === 1 ? '' : 's'}.
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reason (optional, sent in student notification)
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Range closed for emergency maintenance."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep course
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isTimely ? 'Cancel & refund students' : 'Cancel, refund & forfeit deposit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelCourseDialog;
