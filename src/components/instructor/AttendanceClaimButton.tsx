import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShieldQuestion, CheckCircle2, XCircle, Clock, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ClaimRow = {
  id: string;
  status: 'pending' | 'confirmed' | 'denied' | 'auto_approved' | 'admin_review';
  auto_approve_at: string;
  ai_decision: string | null;
  ai_confidence: number | null;
};

type Props = {
  bookingId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  instructorId: string;
  bookingStatus: string;
  className?: string;
};

/**
 * Lets an instructor file an attendance claim when the QR scan was missed.
 * Shows current claim state and links the AI arbiter once the student responds
 * (or once the 48h auto-approval window passes).
 */
export const AttendanceClaimButton = ({
  bookingId,
  courseId,
  studentId,
  studentName,
  instructorId,
  bookingStatus,
  className,
}: Props) => {
  const [claim, setClaim] = useState<ClaimRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [filing, setFiling] = useState(false);
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('attendance_claims')
      .select('id, status, auto_approve_at, ai_decision, ai_confidence')
      .eq('booking_id', bookingId)
      .maybeSingle();
    setClaim((data as ClaimRow | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const fileClaim = async () => {
    setFiling(true);
    // Pull any proximity hits as supporting evidence.
    const { data: hits } = await supabase
      .from('proximity_events')
      .select('distance_m, accuracy_m, smoothed_m, source, verified, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(20);

    const evidence = {
      proximity_hits: hits ?? [],
      proximity_count: hits?.length ?? 0,
      verified_handshake: (hits ?? []).some((h: any) => h.verified),
      filed_from: 'instructor_roster',
    };

    const { data, error } = await supabase
      .from('attendance_claims')
      .insert({
        booking_id: bookingId,
        course_id: courseId,
        instructor_id: instructorId,
        student_id: studentId,
        instructor_note: note.trim() || null,
        evidence,
      })
      .select('id, status, auto_approve_at, ai_decision, ai_confidence')
      .maybeSingle();

    setFiling(false);
    if (error) {
      toast.error('Could not file claim', { description: error.message });
      return;
    }
    setClaim((data as ClaimRow) ?? null);
    setShowForm(false);
    setNote('');
    toast.success(`${studentName} has been notified to confirm`, {
      description: 'Auto-approves in 48h if they don\'t respond.',
    });

    // Send notification.
    await supabase.from('notifications').insert({
      recipient_id: studentId,
      type: 'attendance_claim',
      title: 'Did you attend the course?',
      body: `Your instructor reports you attended. Confirm or dispute within 48h.`,
      link: `/student/booking/${bookingId}`,
    });
  };

  if (bookingStatus === 'attended') return null;
  if (loading) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] text-muted-foreground', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }

  if (claim) {
    const hoursLeft = Math.max(
      0,
      Math.round((new Date(claim.auto_approve_at).getTime() - Date.now()) / 3_600_000),
    );
    const tone =
      claim.status === 'confirmed' || claim.status === 'auto_approved'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
        : claim.status === 'denied'
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : claim.status === 'admin_review'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
        : 'border-border bg-muted text-muted-foreground';
    const icon =
      claim.status === 'confirmed' || claim.status === 'auto_approved' ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : claim.status === 'denied' ? (
        <XCircle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      );
    const label =
      claim.status === 'pending'
        ? `Claim pending · auto-approves in ${hoursLeft}h`
        : claim.status === 'confirmed'
        ? 'Student confirmed'
        : claim.status === 'auto_approved'
        ? 'Auto-approved (no reply)'
        : claim.status === 'denied'
        ? 'Student denied'
        : 'Under admin review';
    return (
      <div className={cn('inline-flex flex-col gap-1', className)}>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider',
            tone,
          )}
        >
          {icon}
          {label}
        </span>
        {claim.ai_decision && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Bot className="h-3 w-3" /> AI: {claim.ai_decision}
            {claim.ai_confidence != null && ` (${Math.round(claim.ai_confidence * 100)}%)`}
          </span>
        )}
      </div>
    );
  }

  if (showForm) {
    return (
      <div className={cn('flex flex-col gap-2 w-full', className)}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional: brief note (e.g. arrived 10min late, sat in row 2)"
          rows={2}
          className="w-full text-xs rounded-sm border border-border bg-background p-2 resize-none"
        />
        <div className="flex gap-1.5">
          <button
            disabled={filing}
            onClick={fileClaim}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-primary/40 bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider hover:bg-primary/20 disabled:opacity-50"
          >
            {filing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldQuestion className="h-3 w-3" />}
            Send to student
          </button>
          <button
            disabled={filing}
            onClick={() => {
              setShowForm(false);
              setNote('');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-amber-500/40 bg-amber-500/10 text-amber-600 text-[11px] font-bold uppercase tracking-wider hover:bg-amber-500/20',
        className,
      )}
    >
      <ShieldQuestion className="h-3 w-3" />
      Claim attendance
    </button>
  );
};
