import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/fees';

type DisputableRefund = {
  id: string;
  booking_id: string;
  amount_cents: number;
  reason: string;
  risk_score: number | null;
  dispute_window_until: string;
  created_at: string;
  studentName: string;
  courseTitle: string;
};

/**
 * Shows auto-issued refunds on the instructor's bookings that are still
 * within the 24h dispute window. Lets the instructor reverse the credit
 * with a reason — escalates to owner for review.
 */
export const AutoRefundDisputes = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<DisputableRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<DisputableRefund | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void load();
  }, [user?.id]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);

    // Find this instructor's course IDs first (RLS already restricts refund visibility).
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title')
      .eq('instructor_id', user.id);
    const courseIds = (courses ?? []).map((c: any) => c.id);
    if (courseIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const courseTitleMap = new Map((courses ?? []).map((c: any) => [c.id, c.title]));

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, course_id, student_id')
      .in('course_id', courseIds);
    const bookingIds = (bookings ?? []).map((b: any) => b.id);
    const bookingMap = new Map((bookings ?? []).map((b: any) => [b.id, b]));
    if (bookingIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: refunds, error } = await supabase
      .from('refunds')
      .select('id, booking_id, amount_cents, reason, risk_score, dispute_window_until, created_at, status, instructor_disputed_at, auto_issued')
      .in('booking_id', bookingIds)
      .eq('auto_issued', true)
      .eq('status', 'issued')
      .is('instructor_disputed_at', null);
    if (error) {
      toast.error('Could not load auto-credits', { description: error.message });
      setLoading(false);
      return;
    }
    const now = Date.now();
    const open = (refunds ?? []).filter(
      (r: any) => r.dispute_window_until && new Date(r.dispute_window_until).getTime() > now,
    );
    const studentIds = Array.from(new Set(open.map((r: any) => bookingMap.get(r.booking_id)?.student_id).filter(Boolean)));
    const { data: profiles } = studentIds.length
      ? await supabase.from('profiles').select('id, display_name').in('id', studentIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));

    setRows(
      open.map((r: any) => {
        const b = bookingMap.get(r.booking_id);
        return {
          id: r.id,
          booking_id: r.booking_id,
          amount_cents: r.amount_cents,
          reason: r.reason,
          risk_score: r.risk_score,
          dispute_window_until: r.dispute_window_until,
          created_at: r.created_at,
          studentName: profileMap.get(b?.student_id) ?? 'Student',
          courseTitle: courseTitleMap.get(b?.course_id) ?? 'Course',
        };
      }),
    );
    setLoading(false);
  };

  const submitDispute = async () => {
    if (!active) return;
    if (reason.trim().length < 10) {
      toast.error('Please explain why this credit shouldn\'t have been issued (10+ chars)');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('instructor_dispute_refund', {
      _refund_id: active.id,
      _reason: reason.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error('Could not file dispute', { description: error.message });
      return;
    }
    toast.success('Dispute filed — owner will review');
    setActive(null);
    setReason('');
    void load();
  };

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <div className="tactical-card border-amber-500/40 bg-amber-500/5 p-4 my-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <div className="text-sm font-bold uppercase tracking-wider text-amber-600">
          Auto-issued credits awaiting your review
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        These credits were automatically issued to students based on their dispute messages. If any of these aren't right (e.g. you DID show up, the student is lying), dispute within 24 hours and the credit will be reversed.
      </p>
      <div className="space-y-2">
        {rows.map((r) => {
          const hoursLeft = Math.max(
            0,
            Math.round((new Date(r.dispute_window_until).getTime() - Date.now()) / 3600000),
          );
          return (
            <div
              key={r.id}
              className="rounded border border-border bg-background p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">
                  {fmt(r.amount_cents)} credit to {r.studentName}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {r.courseTitle} · "{r.reason}"
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                  <span className="text-amber-600 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {hoursLeft}h left to dispute
                  </span>
                  {typeof r.risk_score === 'number' && (
                    <span className="text-muted-foreground">
                      Student risk: {r.risk_score}/100
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActive(r)}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
              >
                Dispute
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute this auto-credit</DialogTitle>
            <DialogDescription>
              Reversing will void the {active && fmt(active.amount_cents)} credit and escalate to the owner for review. Use this only when the student's claim is false (e.g. you were there, the course happened, etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-semibold">Why is this credit wrong?</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="e.g. I was at the range from 9am to noon, the student never showed and didn't call. I have other students who can confirm."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActive(null); setReason(''); }} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitDispute} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reverse credit & escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutoRefundDisputes;
