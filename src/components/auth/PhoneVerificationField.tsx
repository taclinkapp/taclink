import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Props = {
  phone: string;
  onPhoneChange: (v: string) => void;
  verified: boolean;
  onVerified: (normalizedPhone: string) => void;
  required?: boolean;
};

const RESEND_COOLDOWN = 30; // seconds

export function PhoneVerificationField({ phone, onPhoneChange, verified, onVerified, required }: Props) {
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<'incorrect' | 'expired' | 'rate' | 'other' | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [cooldown]);

  const startCooldown = () => setCooldown(RESEND_COOLDOWN);

  const sendCode = async () => {
    if (cooldown > 0) return;
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid phone number first');
      setErrorKind('other');
      return;
    }
    setSending(true);
    setError(null);
    setErrorKind(null);
    const { data, error: invokeErr } = await supabase.functions.invoke('send-phone-code', { body: { phone } });
    setSending(false);
    const errMsg = (data as any)?.error || invokeErr?.message;
    if (errMsg) {
      const isRate = /too many/i.test(errMsg);
      setError(errMsg);
      setErrorKind(isRate ? 'rate' : 'other');
      toast.error(errMsg);
      return;
    }
    setSent(true);
    setCode('');
    startCooldown();
    toast.success('Code sent', { description: 'Check your text messages.' });
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code');
      setErrorKind('other');
      return;
    }
    setVerifying(true);
    setError(null);
    setErrorKind(null);
    const { data, error: invokeErr } = await supabase.functions.invoke('verify-phone-code', { body: { phone, code } });
    setVerifying(false);
    const errMsg = (data as any)?.error || invokeErr?.message;
    if (errMsg) {
      const lower = errMsg.toLowerCase();
      let kind: typeof errorKind = 'other';
      if (lower.includes('expired')) kind = 'expired';
      else if (lower.includes('incorrect')) kind = 'incorrect';
      else if (lower.includes('too many')) kind = 'rate';
      else if (lower.includes('no active')) kind = 'expired';
      setError(errMsg);
      setErrorKind(kind);
      return;
    }
    const normalized = (data as any)?.phone || phone;
    onVerified(normalized);
    toast.success('Phone verified');
  };

  const errorHelp =
    errorKind === 'incorrect' ? 'Double-check the digits, or tap Resend code for a fresh one.' :
    errorKind === 'expired' ? 'That code is no longer valid. Tap Resend code to get a new one.' :
    errorKind === 'rate' ? 'You\'ve requested several codes recently. Please wait a bit before trying again.' :
    null;

  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Phone {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="grid grid-cols-[1fr_auto] gap-2 mt-1.5">
        <Input
          type="tel"
          required={required}
          value={phone}
          onChange={(e) => {
            onPhoneChange(e.target.value);
            if (verified) onVerified('');
            setSent(false);
            setError(null);
            setErrorKind(null);
          }}
          disabled={verified}
          className="bg-card border-border h-11"
          placeholder="(555) 555-5555"
        />
        {verified ? (
          <div className="h-11 px-3 rounded-md bg-primary/15 text-primary flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
            <Check className="h-4 w-4" /> Verified
          </div>
        ) : (
          <Button
            type="button"
            onClick={sendCode}
            disabled={sending || cooldown > 0}
            variant="outline"
            className="h-11 px-3 text-xs uppercase tracking-wider font-bold"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> :
              cooldown > 0 ? `${cooldown}s` :
              sent ? 'Resend code' : 'Send code'}
          </Button>
        )}
      </div>

      {sent && !verified && (
        <>
          <div className="grid grid-cols-[1fr_auto] gap-2 mt-2">
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                if (error) { setError(null); setErrorKind(null); }
              }}
              placeholder="6-digit code"
              aria-invalid={!!error}
              className={`bg-card h-11 tracking-[0.4em] text-center font-mono ${error ? 'border-destructive focus-visible:ring-destructive' : 'border-border'}`}
            />
            <Button type="button" onClick={verifyCode} disabled={verifying || code.length !== 6} className="h-11 px-4 text-xs uppercase tracking-wider font-bold">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
            </Button>
          </div>
          <div className="flex items-start justify-between gap-3 mt-1.5">
            <div className="text-[11px] text-muted-foreground">
              Didn't get it? {cooldown > 0
                ? <>Resend available in <span className="font-mono">{cooldown}s</span>.</>
                : <button type="button" onClick={sendCode} className="text-primary font-bold hover:underline">Resend code</button>}
            </div>
          </div>
        </>
      )}

      {error && !verified && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-[11px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <div className="font-bold">{error}</div>
            {errorHelp && <div className="text-destructive/80">{errorHelp}</div>}
            {(errorKind === 'incorrect' || errorKind === 'expired') && cooldown === 0 && (
              <button type="button" onClick={sendCode} className="underline font-bold hover:no-underline mt-0.5">
                Resend code now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
