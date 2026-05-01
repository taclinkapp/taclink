import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CalendarClock, Loader2, Rocket } from 'lucide-react';

/**
 * Owner Cockpit widget for controlling the pre-launch state:
 *  - Toggle pre-launch mode on/off
 *  - Edit the public launch date (drives the splash countdown clock)
 *
 * Both values live in the `platform_settings` table so the rest of the app
 * can react via the `usePrelaunch` hook.
 */
export const PrelaunchControlCard = () => {
  const [enabled, setEnabled] = useState(false);
  const [launchDate, setLaunchDate] = useState<string>(''); // datetime-local
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isoToLocalInput = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_settings')
      .select('key,value')
      .in('key', ['prelaunch_mode', 'launch_date']);
    const map = new Map((data ?? []).map((r: any) => [r.key, r.value]));
    const rawMode = map.get('prelaunch_mode');
    setEnabled(rawMode === true || rawMode === 'true');
    const rawDate = map.get('launch_date');
    if (typeof rawDate === 'string') {
      setLaunchDate(isoToLocalInput(rawDate.length === 10 ? `${rawDate}T12:00:00` : rawDate));
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const save = async () => {
    setSaving(true);
    // Snapshot prior state to detect ON→OFF transition.
    const { data: priorRows } = await supabase
      .from('platform_settings')
      .select('key,value')
      .eq('key', 'prelaunch_mode');
    const priorRaw = priorRows?.[0]?.value;
    const wasEnabled = priorRaw === true || priorRaw === 'true';

    const modeRes = await supabase
      .from('platform_settings')
      .update({ value: enabled })
      .eq('key', 'prelaunch_mode');
    let dateErr: { message: string } | null = null;
    if (launchDate) {
      const iso = new Date(launchDate).toISOString();
      const dateRes = await supabase
        .from('platform_settings')
        .update({ value: iso })
        .eq('key', 'launch_date');
      dateErr = dateRes.error;
    }
    setSaving(false);
    const firstError = modeRes.error ?? dateErr;
    if (firstError) {
      toast.error(firstError.message);
      return;
    }
    toast.success('Pre-launch settings saved');

    // Fire instructor unlock notification on ON→OFF transition.
    if (wasEnabled && !enabled) {
      toast.info('Notifying instructors that Pro is unlocked…');
      const { data, error } = await supabase.functions.invoke(
        'notify-prelaunch-unlock',
        { body: {} },
      );
      if (error) {
        toast.error(`Notification failed: ${error.message}`);
      } else if ((data as any)?.skipped) {
        toast.message('Instructors were already notified for this launch.');
      } else {
        const queued = (data as any)?.queued ?? 0;
        toast.success(`Queued unlock email for ${queued} instructor(s).`);
      }
    }
    refresh();
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pre-launch settings…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center text-primary shrink-0">
          <Rocket className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold">Pre-launch mode</h3>
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            When ON: students &amp; instructors can browse the app, instructors can draft courses but
            <strong> can't publish</strong>, and the monthly subscription page is hidden.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3 w-3" /> Public launch date &amp; time
          </Label>
          <Input
            type="datetime-local"
            value={launchDate}
            onChange={(e) => setLaunchDate(e.target.value)}
            className="bg-background border-border h-10 mt-1.5 font-mono"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Drives the countdown clock on the splash screen. Local time on this device.
          </p>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-primary text-primary-foreground font-bold h-10"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  );
};
