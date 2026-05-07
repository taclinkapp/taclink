import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Props = {
  phone: string;
  onPhoneChange: (v: string) => void;
  verified: boolean;
  onVerified: (normalizedPhone: string) => void;
  required?: boolean;
};

export function PhoneVerificationField({ phone, onPhoneChange, verified, onVerified, required }: Props) {
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendCode = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid phone number first');
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-phone-code', { body: { phone } });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Failed to send code');
      return;
    }
    setSent(true);
    toast.success('Code sent', { description: 'Check your text messages.' });
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) { toast.error('Enter the 6-digit code'); return; }
    setVerifying(true);
    const { data, error } = await supabase.functions.invoke('verify-phone-code', { body: { phone, code } });
    setVerifying(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Verification failed');
      return;
    }
    const normalized = (data as any)?.phone || phone;
    onVerified(normalized);
    toast.success('Phone verified');
  };

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
          onChange={(e) => { onPhoneChange(e.target.value); if (verified) onVerified(''); setSent(false); }}
          disabled={verified}
          className="bg-card border-border h-11"
          placeholder="(555) 555-5555"
        />
        {verified ? (
          <div className="h-11 px-3 rounded-md bg-primary/15 text-primary flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
            <Check className="h-4 w-4" /> Verified
          </div>
        ) : (
          <Button type="button" onClick={sendCode} disabled={sending} variant="outline" className="h-11 px-3 text-xs uppercase tracking-wider font-bold">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? 'Resend' : 'Send code'}
          </Button>
        )}
      </div>
      {sent && !verified && (
        <div className="grid grid-cols-[1fr_auto] gap-2 mt-2">
          <Input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            className="bg-card border-border h-11 tracking-[0.4em] text-center font-mono"
          />
          <Button type="button" onClick={verifyCode} disabled={verifying || code.length !== 6} className="h-11 px-4 text-xs uppercase tracking-wider font-bold">
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
          </Button>
        </div>
      )}
    </div>
  );
}
