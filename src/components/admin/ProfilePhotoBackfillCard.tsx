import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Image as ImageIcon, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Result = {
  ok?: boolean;
  scanned?: number;
  orphansFound?: number;
  linked?: number;
  alreadyLinked?: number;
  dryRun?: boolean;
  error?: string;
};

/**
 * Admin one-click trigger for the photo-link backfill.
 *
 * Background: Earlier in the project a UI bug caused some users to upload
 * a profile photo to storage without it ever being persisted to
 * profiles.photo_url. The upload flow has since been hardened with
 * auto-retry + orphan cleanup, but if it ever regresses we want a single
 * button that re-runs the audit and links every orphan.
 */
export const ProfilePhotoBackfillCard = () => {
  const [running, setRunning] = useState<'dry' | 'fix' | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = async (dryRun: boolean) => {
    setRunning(dryRun ? 'dry' : 'fix');
    setResult(null);
    const { data, error } = await supabase.functions.invoke(
      'admin-backfill-profile-photos',
      { body: { dryRun } },
    );
    setRunning(null);
    if (error) {
      const msg = error.message || 'Backfill failed';
      setResult({ error: msg });
      toast.error('Backfill failed', { description: msg });
      return;
    }
    setResult(data as Result);
    if (dryRun) {
      toast.message(`Found ${data?.orphansFound ?? 0} orphan photo(s)`);
    } else {
      toast.success(`Linked ${data?.linked ?? 0} profile photo(s)`);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <ImageIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm">Profile photo audit</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scans storage for uploaded profile photos that aren't linked to a
            user's profile and links the most recent one. Safe to re-run any time.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => run(true)}
          disabled={!!running}
          className="flex-1"
        >
          {running === 'dry' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Preview'}
        </Button>
        <Button
          size="sm"
          onClick={() => run(false)}
          disabled={!!running}
          className="flex-1"
        >
          {running === 'fix' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Run backfill'}
        </Button>
      </div>

      {result?.error && (
        <div className="flex items-start gap-1.5 text-xs text-destructive rounded-md border border-destructive/40 bg-destructive/10 p-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}

      {result?.ok && (
        <div className="flex items-start gap-1.5 text-xs text-foreground rounded-md border border-border bg-muted/40 p-2">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <div className="space-y-0.5">
            <div>
              Scanned <strong>{result.scanned ?? 0}</strong> user folder(s) ·
              {' '}<strong>{result.orphansFound ?? 0}</strong> orphan(s)
              {' · '}<strong>{result.alreadyLinked ?? 0}</strong> already linked
            </div>
            {!result.dryRun && (
              <div>Linked <strong>{result.linked ?? 0}</strong> profile photo(s).</div>
            )}
            {result.dryRun && (result.orphansFound ?? 0) > 0 && (
              <div className="text-muted-foreground">Tap "Run backfill" to apply.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
