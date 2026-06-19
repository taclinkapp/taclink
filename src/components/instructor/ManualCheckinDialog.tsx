import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Props = {
  open: boolean;
  courseId: string;
  onOpenChange: (open: boolean) => void;
  onVerified: (result: { bookingId: string; alreadyAttended?: boolean; studentName?: string | null }) => void;
};

export const ManualCheckinDialog = ({ open, courseId, onOpenChange, onVerified }: Props) => {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) {
      setError('Enter the full 6-digit code.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('verify-checkin-code', {
        body: { courseId, code: clean },
      });
      if (fnErr) {
        let msg = fnErr.message ?? 'Could not verify code';
        try {
          const ctx: any = (fnErr as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.reason) msg = body.reason;
          }
        } catch { /* ignore */ }
        setError(msg);
        return;
      }
      if (!data?.ok) {
        setError(data?.reason ?? 'Code not recognised.');
        return;
      }
      setCode('');
      onVerified({
        bookingId: data.bookingId,
        alreadyAttended: !!data.alreadyAttended,
        studentName: data.studentName ?? null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Manual check-in
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ask the student for the 6-digit backup code shown under their QR.
            Codes activate 30 minutes before the course starts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Input
            inputMode="numeric"
            autoFocus
            maxLength={7}
            placeholder="000 000"
            value={code}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            className="text-center font-mono text-2xl tracking-[0.35em] h-14"
          />
          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || code.replace(/\D/g, '').length !== 6}
            className="flex-1 bg-primary text-primary-foreground font-bold"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
