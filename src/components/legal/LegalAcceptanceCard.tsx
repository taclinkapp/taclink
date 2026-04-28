import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ShieldCheck, FileText, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PRIVACY_VERSION = 'privacy-v1.0';
const TERMS_VERSION = 'terms-v1.0';

type AckRow = { policy_version: string; created_at: string };

export const LegalAcceptanceCard = () => {
  const { user } = useAuth();
  const [acks, setAcks] = useState<AckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

  const latest = (v: string) =>
    acks.filter((a) => a.policy_version === v).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const privacyAck = latest(PRIVACY_VERSION);
  const termsAck = latest(TERMS_VERSION);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('policy_acknowledgments')
        .select('policy_version, created_at')
        .eq('user_id', user.id)
        .in('policy_version', [PRIVACY_VERSION, TERMS_VERSION])
        .order('created_at', { ascending: false });
      if (!cancelled) {
        setAcks(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const acceptAll = async () => {
    if (!user?.id) return;
    if (!privacyChecked || !termsChecked) {
      toast.error('Please check both boxes to accept.');
      return;
    }
    setSaving(true);
    const rows: any[] = [];
    if (!privacyAck) rows.push({ user_id: user.id, policy_version: PRIVACY_VERSION, user_agent: navigator.userAgent });
    if (!termsAck) rows.push({ user_id: user.id, policy_version: TERMS_VERSION, user_agent: navigator.userAgent });
    if (rows.length === 0) {
      setSaving(false);
      toast.success('Already on file');
      return;
    }
    const { data, error } = await supabase
      .from('policy_acknowledgments')
      .insert(rows)
      .select('policy_version, created_at');
    setSaving(false);
    if (error) {
      toast.error('Could not record acceptance', { description: error.message });
      return;
    }
    setAcks((prev) => [...(data ?? []), ...prev]);
    setPrivacyChecked(false);
    setTermsChecked(false);
    toast.success('Acceptance recorded');
  };

  const allAccepted = !!privacyAck && !!termsAck;

  if (loading) {
    return (
      <div className="tactical-card p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading legal status…
      </div>
    );
  }

  return (
    <div className="tactical-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
            allAccepted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary',
          )}
        >
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold">Instructor agreement</div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Confirm you've read and accept the documents that govern your instructor account.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <AckLine
          icon={ScrollText}
          label="Terms of Service"
          to="/legal/terms"
          ack={termsAck}
          checked={termsChecked}
          onChange={setTermsChecked}
        />
        <AckLine
          icon={FileText}
          label="Privacy Policy"
          to="/legal/privacy"
          ack={privacyAck}
          checked={privacyChecked}
          onChange={setPrivacyChecked}
        />
      </div>

      {(!privacyAck || !termsAck) && (
        <button
          onClick={acceptAll}
          disabled={saving || (!privacyChecked && !termsChecked) || (!privacyAck && !privacyChecked) || (!termsAck && !termsChecked)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Accept &amp; record
        </button>
      )}
    </div>
  );
};

const AckLine = ({
  icon: Icon,
  label,
  to,
  ack,
  checked,
  onChange,
}: {
  icon: any;
  label: string;
  to: string;
  ack?: AckRow;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => {
  const accepted = !!ack;
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        {accepted ? (
          <div className="h-5 w-5 rounded-sm bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
        ) : (
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => onChange(!!v)}
            className="mt-0.5"
            aria-label={`Accept ${label}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            {label}
          </div>
          {accepted ? (
            <div className="text-[11px] text-emerald-600 mt-0.5">
              Accepted {new Date(ack!.created_at).toLocaleString()}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              I have read and agree to the{' '}
              <Link to={to} className="underline text-primary">
                {label}
              </Link>
              .
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
