import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CalendarClock, Loader2, Rocket } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

type Mode = 'prelaunch' | 'live' | 'paused';

type LaunchRow = {
  launch_mode: Mode;
  launch_at: string | null;
  manual_override: boolean;
  countdown_enabled: boolean;
  bookings_enabled: boolean;
  course_creation_enabled: boolean;
  publish_enabled: boolean;
  pro_unlock_enabled: boolean;
  waitlist_enabled: boolean;
  maintenance_message: string | null;
  activated_at: string | null;
};

const isoToLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Owner Cockpit widget — single source of truth for launch state.
 * Maps directly onto `public.launch_config` and re-reads after save.
 */
export const PrelaunchControlCard = () => {
  const qc = useQueryClient();
  const [row, setRow] = useState<LaunchRow | null>(null);
  const [launchDate, setLaunchDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('launch_config' as any)
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (data) {
      const r = data as unknown as LaunchRow;
      setRow(r);
      setLaunchDate(isoToLocalInput(r.launch_at));
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const update = <K extends keyof LaunchRow>(k: K, v: LaunchRow[K]) => {
    setRow(prev => prev ? { ...prev, [k]: v } : prev);
  };

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const iso = launchDate ? new Date(launchDate).toISOString() : null;
    const { error } = await (supabase as any)
      .from('launch_config')
      .update({
        launch_mode: row.launch_mode,
        launch_at: iso,
        manual_override: row.manual_override,
        countdown_enabled: row.countdown_enabled,
        bookings_enabled: row.bookings_enabled,
        course_creation_enabled: row.course_creation_enabled,
        publish_enabled: row.publish_enabled,
        pro_unlock_enabled: row.pro_unlock_enabled,
        waitlist_enabled: row.waitlist_enabled,
        maintenance_message: row.maintenance_message?.trim() || null,
      })
      .eq('id', true);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Launch settings saved');
    qc.invalidateQueries({ queryKey: ['launch_state'] });
    refresh();
  };

  const triggerActivation = async () => {
    const { error } = await supabase.functions.invoke('launch-activate', { body: {} });
    if (error) toast.error(error.message);
    else { toast.success('Activation check ran'); qc.invalidateQueries({ queryKey: ['launch_state'] }); refresh(); }
  };

  if (loading || !row) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading launch settings…
      </div>
    );
  }

  const modePill = (m: Mode, active: boolean) => (
    <button
      key={m}
      onClick={() => update('launch_mode', m)}
      className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded border transition ${
        active
          ? m === 'live' ? 'bg-emerald-500 text-white border-emerald-500'
            : m === 'paused' ? 'bg-amber-500 text-white border-amber-500'
            : 'bg-primary text-primary-foreground border-primary'
          : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
      }`}
    >
      {m}
    </button>
  );

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center text-primary shrink-0">
          <Rocket className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold">Launch control</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Single source of truth for prelaunch / live / paused. Auto-promotes to <b>live</b> when launch time passes — unless manual override is on.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Mode</span>
        {(['prelaunch','live','paused'] as Mode[]).map(m => modePill(m, row.launch_mode === m))}
        {row.activated_at && (
          <span className="text-[10px] text-muted-foreground ml-auto">activated {new Date(row.activated_at).toLocaleString()}</span>
        )}
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
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <ToggleRow label="Manual override" hint="When on, mode won't auto-flip at launch time" checked={row.manual_override} onChange={v => update('manual_override', v)} />
        <ToggleRow label="Countdown enabled" checked={row.countdown_enabled} onChange={v => update('countdown_enabled', v)} />
        <ToggleRow label="Bookings enabled" checked={row.bookings_enabled} onChange={v => update('bookings_enabled', v)} />
        <ToggleRow label="Course creation" checked={row.course_creation_enabled} onChange={v => update('course_creation_enabled', v)} />
        <ToggleRow label="Publish enabled" checked={row.publish_enabled} onChange={v => update('publish_enabled', v)} />
        <ToggleRow label="Pro unlock" checked={row.pro_unlock_enabled} onChange={v => update('pro_unlock_enabled', v)} />
        <ToggleRow label="Waitlist enabled" checked={row.waitlist_enabled} onChange={v => update('waitlist_enabled', v)} />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Maintenance message (paused mode banner)</Label>
        <Textarea
          rows={2}
          value={row.maintenance_message ?? ''}
          onChange={(e) => update('maintenance_message', e.target.value)}
          placeholder="Optional banner text shown when paused"
          className="bg-background border-border mt-1.5 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground font-bold h-10">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save launch settings'}
        </Button>
        <Button variant="outline" onClick={triggerActivation} className="h-10">
          Run activation check
        </Button>
      </div>
    </div>
  );
};

const ToggleRow = ({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/50 px-3 py-2">
    <div className="min-w-0">
      <div className="text-xs font-bold truncate">{label}</div>
      {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);
