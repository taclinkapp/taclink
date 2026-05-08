import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2, Sparkles, X, AlertTriangle, Check, Lock, Unlock, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

type Plan = {
  id?: string;
  slug: string;
  name: string;
  description: string | null;
  audience: 'instructor' | 'student' | 'all';
  price_cents: number;
  currency: string;
  billing_interval: 'month' | 'year' | 'one_time';
  features: string[];
  highlight: boolean;
  sort_order: number;
  active: boolean;
  locked?: boolean;
  locked_reason?: string | null;
  ai_validation?: any;
};

const BLANK: Plan = {
  slug: '', name: '', description: '', audience: 'instructor',
  price_cents: 0, currency: 'USD', billing_interval: 'month',
  features: [], highlight: false, sort_order: 0, active: true, locked: false,
};

export default function AdminSubscriptionPlans() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [featureDraft, setFeatureDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [brainstorming, setBrainstorming] = useState(false);
  const [brainstorm, setBrainstorm] = useState<{ features: string[]; rationale: string } | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin-subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans' as any)
        .select('*')
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    },
  });

  const startNew = () => { setEditing({ ...BLANK }); setValidation(null); setBrainstorm(null); };
  const startEdit = (p: Plan) => { setEditing({ ...p, features: p.features ?? [] }); setValidation(p.ai_validation ?? null); setBrainstorm(null); };

  const addFeature = () => {
    const f = featureDraft.trim();
    if (!f || !editing) return;
    setEditing({ ...editing, features: [...editing.features, f] });
    setFeatureDraft('');
  };
  const removeFeature = (i: number) => {
    if (!editing) return;
    setEditing({ ...editing, features: editing.features.filter((_, idx) => idx !== i) });
  };

  const callAI = async (apply: boolean) => {
    if (!editing) return;
    if (!editing.name || !editing.slug) { toast.error('Slug and name required'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('subscription-plan-ai', {
        body: { plan: editing, apply },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setValidation(data.validation);
      if (apply) {
        toast.success('Plan saved & live');
        qc.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
        setEditing(data.plan);
      } else {
        toast.success('Validation complete');
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    const { error } = await supabase.from('subscription_plans' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Deleted');
    qc.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
    if (editing?.id === id) setEditing(null);
  };

  const toggleActive = async (p: Plan) => {
    const { error } = await supabase.from('subscription_plans' as any).update({ active: !p.active }).eq('id', p.id!);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
  };

  const toggleLock = async (p: Plan) => {
    const next = !p.locked;
    let reason: string | null = p.locked_reason ?? null;
    if (next) {
      reason = window.prompt('Lock reason (shown to users when they try to subscribe):', reason ?? 'This plan is temporarily unavailable.');
      if (reason === null) return;
    }
    const { error } = await supabase.from('subscription_plans' as any).update({
      locked: next,
      locked_reason: next ? reason : null,
      locked_at: next ? new Date().toISOString() : null,
    }).eq('id', p.id!);
    if (error) return toast.error(error.message);
    toast.success(next ? 'Plan locked — users can no longer choose it' : 'Plan unlocked');
    qc.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
  };

  const runBrainstorm = async () => {
    if (!editing) return;
    setBrainstorming(true);
    try {
      const { data, error } = await supabase.functions.invoke('subscription-plan-ai', {
        body: { action: 'brainstorm', plan: editing },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBrainstorm({ features: data.features ?? [], rationale: data.rationale ?? '' });
    } catch (e: any) {
      toast.error(e.message ?? 'Brainstorm failed');
    } finally {
      setBrainstorming(false);
    }
  };

  const addBrainstormFeature = (f: string) => {
    if (!editing) return;
    if (editing.features.includes(f)) return;
    setEditing({ ...editing, features: [...editing.features, f] });
    setBrainstorm((b) => b ? { ...b, features: b.features.filter((x) => x !== f) } : b);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-sm text-muted-foreground">Create, validate, and publish plans live.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> New Plan</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : plans.length === 0 ? (
            <div className="tactical-card p-6 text-center text-muted-foreground">No plans yet.</div>
          ) : plans.map((p) => (
            <div key={p.id} className="tactical-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold">{p.name}</h3>
                    <Badge variant="outline">{p.audience}</Badge>
                    {p.highlight && <Badge>Highlighted</Badge>}
                    {!p.active && <Badge variant="destructive">Inactive</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.slug} · ${(p.price_cents / 100).toFixed(2)}/{p.billing_interval}
                  </div>
                  {p.description && <p className="text-sm mt-2">{p.description}</p>}
                  {p.features?.length > 0 && (
                    <ul className="mt-2 text-xs space-y-0.5">
                      {p.features.map((f, i) => <li key={i}>• {f}</li>)}
                    </ul>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>
                    {p.active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id!)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {editing && (
          <div className="tactical-card p-5 space-y-4 sticky top-4 self-start">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{editing.id ? 'Edit Plan' : 'New Plan'}</h2>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Slug"><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="pro-monthly" /></Field>
              <Field label="Name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Operator Pro" /></Field>
            </div>

            <Field label="Description">
              <Textarea rows={2} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Audience">
                <Select value={editing.audience} onValueChange={(v: any) => setEditing({ ...editing, audience: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Price (¢)"><Input type="number" value={editing.price_cents} onChange={(e) => setEditing({ ...editing, price_cents: +e.target.value })} /></Field>
              <Field label="Interval">
                <Select value={editing.billing_interval} onValueChange={(v: any) => setEditing({ ...editing, billing_interval: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                    <SelectItem value="one_time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Features">
              <div className="flex gap-2">
                <Input value={featureDraft} onChange={(e) => setFeatureDraft(e.target.value)} placeholder="Unlimited course listings"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }} />
                <Button type="button" onClick={addFeature}>Add</Button>
              </div>
              {editing.features.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {editing.features.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-sm bg-muted/40 px-2 py-1 rounded">
                      <span>• {f}</span>
                      <button onClick={() => removeFeature(i)} className="text-destructive"><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing.highlight} onCheckedChange={(v) => setEditing({ ...editing, highlight: v })} /> Highlight
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /> Active
              </label>
              <Field label="Sort"><Input className="w-20" type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: +e.target.value })} /></Field>
            </div>

            {validation && (
              <div className="rounded-md border border-border p-3 text-sm space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  {validation.ok ? <Check className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-orange-400" />}
                  AI Validation
                </div>
                {validation.issues?.length > 0 && (
                  <div><div className="text-xs font-semibold text-orange-400">Issues</div>
                    <ul className="text-xs">{validation.issues.map((x: string, i: number) => <li key={i}>• {x}</li>)}</ul></div>
                )}
                {validation.suggestions?.length > 0 && (
                  <div><div className="text-xs font-semibold text-primary">Suggestions</div>
                    <ul className="text-xs">{validation.suggestions.map((x: string, i: number) => <li key={i}>• {x}</li>)}</ul></div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" disabled={saving} onClick={() => callAI(false)}>
                <Sparkles className="h-4 w-4 mr-1" /> Validate
              </Button>
              <Button disabled={saving} onClick={() => callAI(true)} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Validate & Publish Live
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
