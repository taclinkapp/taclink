import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, XCircle, Clock, Loader2, ShieldQuestion, Bot } from 'lucide-react';
import { toast } from 'sonner';

type ClaimRow = {
  id: string;
  status: 'pending' | 'confirmed' | 'denied' | 'auto_approved' | 'admin_review';
  auto_approve_at: string;
  instructor_note: string | null;
  ai_decision: string | null;
  ai_confidence: number | null;
};

/**
 * Student-facing card to confirm or deny an instructor's attendance claim.
 * If the student does nothing within 48h, the cron auto-approves it.
 */
export const AttendanceClaimResponse = ({ bookingId }: { bookingId: string }) => {
  const { user } = useAuth();
  const [claim, setClaim] = useState<ClaimRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [denyNote, setDenyNote] = useState('');
  const [showDeny, setShowDeny] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('attendance_claims')
      .select('id, status, auto_approve_at, instructor_note, ai_decision, ai_confidence')
      .eq('booking_id', bookingId)
      .maybeSingle();
    setClaim((data as ClaimRow | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const respond = async (status: 'confirmed' | 'denied') => {
    if (!user?.id || !claim) return;
    setResponding(true);
    const { error } = await supabase
      .from('attendance_claims')
      .update({
        status,
        student_responded_at: new Date().toISOString(),
        student_response_note: status === 'denied' ? denyNote.trim() || null : null,
      })
      .eq('id', claim.id);
    setResponding(false);
    if (error) {
      toast.error('Could not save response', { description: error.message });
      return;
    }
    toast.success(
      status === 'confirmed' ? 'Thanks — attendance confirmed.' : 'Got it — your dispute was sent for review.',
    );
    // If denied, ping the AI arbiter for a fast recommendation.
    if (status === 'denied') {
      await supabase.functions
        .invoke('attendance-arbiter', { body: { claim_id: claim.id } })
        .catch(() => {});
    }
    load();
  };

  if (loading || !claim) return null;

  const hoursLeft = Math.max(
    0,
    Math.round((new Date(claim.auto_approve_at).getTime() - Date.now()) / 3_600_000),
  );

  if (claim.status === 'pending') {
    return (
      <div className="tactical-card p-4 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <ShieldQuestion className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold mb-1">Did you attend this course?</div>
            <div className="text-xs text-muted-foreground leading-relaxed mb-3">
              Your instructor reports you attended but didn't scan you in. Please confirm or
              dispute within <strong>{hoursLeft}h</strong>, or this will be auto-approved.
            </div>
            {claim.instructor_note && (
              <div className="text-[11px] italic text-muted-foreground mb-3 border-l-2 border-border pl-2">
                "{claim.instructor_note}"
              </div>
            )}
            {!showDeny ? (
              <div className="flex gap-2">
                <button
                  disabled={responding}
                  onClick={() => respond('confirmed')}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 text-xs font-bold uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {responding ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Yes, I attended
                </button>
                <button
                  disabled={responding}
                  onClick={() => setShowDeny(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-sm border border-destructive/40 bg-destructive/10 text-destructive text-xs font-bold uppercase tracking-wider hover:bg-destructive/20 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  No, dispute
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={denyNote}
                  onChange={(e) => setDenyNote(e.target.value)}
                  placeholder="Briefly explain (helps our AI review your dispute)"
                  className="w-full text-xs rounded-sm border border-border bg-background p-2 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    disabled={responding}
                    onClick={() => respond('denied')}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-sm border border-destructive/40 bg-destructive/10 text-destructive text-xs font-bold uppercase tracking-wider hover:bg-destructive/20 disabled:opacity-50"
                  >
                    {responding ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    Submit dispute
                  </button>
                  <button
                    disabled={responding}
                    onClick={() => setShowDeny(false)}
                    className="px-3 py-2 rounded-sm border border-border text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const tone =
    claim.status === 'confirmed' || claim.status === 'auto_approved'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : claim.status === 'admin_review'
      ? 'border-amber-500/30 bg-amber-500/5'
      : 'border-destructive/30 bg-destructive/5';
  const Icon =
    claim.status === 'confirmed' || claim.status === 'auto_approved'
      ? CheckCircle2
      : claim.status === 'admin_review'
      ? Clock
      : XCircle;
  const label =
    claim.status === 'confirmed'
      ? 'Attendance confirmed'
      : claim.status === 'auto_approved'
      ? 'Attendance auto-approved'
      : claim.status === 'admin_review'
      ? 'Under review by support'
      : 'You disputed this claim';

  return (
    <div className={`tactical-card p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold">{label}</div>
          {claim.ai_decision && (
            <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <Bot className="h-3 w-3" /> AI review: {claim.ai_decision}
              {claim.ai_confidence != null && ` · ${Math.round(claim.ai_confidence * 100)}% confidence`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
