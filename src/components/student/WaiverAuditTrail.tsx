import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, ShieldCheck, Loader2, Clock, Hash, User, Users, Calendar, PenTool, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type Signature = {
  id: string;
  signed_full_name: string;
  signed_at: string;
  waiver_version: number;
  waiver_content_snapshot: string;
  is_minor: boolean | null;
  guardian_full_name: string | null;
  guardian_relationship: string | null;
  guardian_signed_at: string | null;
  student_date_of_birth: string | null;
  esign_consent_acknowledged: boolean | null;
  esign_disclosure_version: string | null;
  esign_consent_initials: string | null;
  user_agent: string | null;
};

interface Props {
  bookingId: string;
}

/**
 * Court-defensible audit-trail card for a booking's waiver signature.
 * Shows the immutable snapshot, signed name, timestamp, version, ESIGN consent,
 * and (when applicable) the parent/guardian co-signature.
 */
export const WaiverAuditTrail = ({ bookingId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [sig, setSig] = useState<Signature | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('waiver_signatures')
        .select('id, signed_full_name, signed_at, waiver_version, waiver_content_snapshot, is_minor, guardian_full_name, guardian_relationship, guardian_signed_at, student_date_of_birth, esign_consent_acknowledged, esign_disclosure_version, esign_consent_initials, user_agent')
        .eq('booking_id', bookingId)
        .maybeSingle();
      if (cancelled) return;
      setSig((data as Signature) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  if (loading) {
    return (
      <div className="tactical-card p-4 text-center text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
        Loading waiver record…
      </div>
    );
  }

  if (!sig) return null;

  const signedAt = new Date(sig.signed_at);
  const guardianSignedAt = sig.guardian_signed_at ? new Date(sig.guardian_signed_at) : null;
  const receiptId = sig.id.slice(0, 8).toUpperCase();

  return (
    <div className="tactical-card p-4 border-primary/40">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-primary" />
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          Waiver Audit Trail
        </div>
        <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">
          v{sig.waiver_version}
        </span>
      </div>

      {/* Student signature */}
      <div className="rounded-md border border-border bg-background p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <PenTool className="h-3 w-3 text-primary" />
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Student signature</div>
        </div>
        <div className="font-serif italic text-lg text-foreground mb-2">{sig.signed_full_name}</div>
        <dl className="space-y-1 text-[11px]">
          <Field icon={Clock} label="Signed at" value={signedAt.toLocaleString()} mono />
          <Field icon={Hash} label="Receipt ID" value={receiptId} mono />
          {sig.student_date_of_birth && (
            <Field icon={Calendar} label="Student DOB" value={new Date(sig.student_date_of_birth).toLocaleDateString()} />
          )}
        </dl>
      </div>

      {/* Parent/guardian co-signature */}
      {sig.is_minor && sig.guardian_full_name && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="h-3 w-3 text-amber-600" />
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-600">Parent / Guardian co-signature</div>
          </div>
          <div className="font-serif italic text-lg text-foreground mb-2">{sig.guardian_full_name}</div>
          <dl className="space-y-1 text-[11px]">
            <Field icon={User} label="Relationship" value={sig.guardian_relationship ?? '—'} />
            {guardianSignedAt && <Field icon={Clock} label="Co-signed at" value={guardianSignedAt.toLocaleString()} mono />}
          </dl>
        </div>
      )}

      {/* ESIGN / UETA consent */}
      {sig.esign_consent_acknowledged && (
        <div className="rounded-md border border-border bg-background p-3 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck className="h-3 w-3 text-primary" />
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">ESIGN / UETA consent</div>
          </div>
          <dl className="space-y-1 text-[11px]">
            <Field label="Consented" value="Yes — explicit electronic-sign intent" />
            {sig.esign_disclosure_version && (
              <Field label="Disclosure version" value={sig.esign_disclosure_version} mono />
            )}
            {sig.esign_consent_initials && (
              <Field label="Typed initials" value={sig.esign_consent_initials} mono />
            )}
          </dl>
        </div>
      )}

      {/* Immutable snapshot */}
      <button
        type="button"
        onClick={() => setShowSnapshot((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-md border border-border bg-background p-3 hover:border-primary/40 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <FileText className="h-3 w-3 text-primary" />
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Immutable waiver snapshot
          </span>
        </div>
        {showSnapshot ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {showSnapshot && (
        <div className="mt-2 rounded-md border border-border bg-background p-3">
          <div className="prose prose-sm max-w-none text-xs max-h-72 overflow-y-auto">
            <ReactMarkdown>{sig.waiver_content_snapshot}</ReactMarkdown>
          </div>
          <p className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground italic">
            This is the exact waiver text as it appeared at the moment of signing. Even if the instructor later edits or republishes the waiver, this record cannot be altered.
          </p>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-[10px] text-muted-foreground">
        <ShieldCheck className="h-3 w-3 text-primary" />
        Append-only record · TacLink stores this signature solely as the record-keeper. The waiver agreement is between the student and the instructor.
      </div>
    </div>
  );
};

const Field = ({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon?: any;
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground flex items-center gap-1.5">
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {label}
    </span>
    <span className={mono ? 'font-mono text-foreground' : 'text-foreground'}>{value}</span>
  </div>
);
