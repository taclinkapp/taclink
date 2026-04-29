import { useEffect, useMemo, useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  PLATFORM_FEE_CENTS, INSTRUCTOR_COMMISSION_PCT, fmt,
} from '@/lib/fees';
import { DollarSign, Loader2, Plus, Trash2 } from 'lucide-react';

type Override = {
  id: string;
  scope: 'course' | 'instructor';
  target_id: string;
  platform_fee_cents: number | null;
  platform_fee_pct: number | null;
  deposit_pct: number | null;
  note: string | null;
  created_at: string;
  targetName?: string;
};

const SAMPLE_PRICE = 15000; // $150 sample course for impact preview

export const AdminFeeOverrides = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Override | null>(null);
  const [form, setForm] = useState({
    scope: 'course' as 'course' | 'instructor',
    target_id: '',
    platform_fee_cents: '',
    platform_fee_pct: '',
    deposit_pct: '',
    note: '',
  });
  const [searchType, setSearchType] = useState<'course' | 'instructor'>('course');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; label: string }>>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('fee_overrides').select('*').order('created_at', { ascending: false });
    const list = (data ?? []) as Override[];
    const courseIds = list.filter((r) => r.scope === 'course').map((r) => r.target_id);
    const instIds = list.filter((r) => r.scope === 'instructor').map((r) => r.target_id);
    const [{ data: courses }, { data: profs }] = await Promise.all([
      courseIds.length ? supabase.from('courses').select('id,title').in('id', courseIds) : Promise.resolve({ data: [] as any[] }),
      instIds.length ? supabase.from('profiles').select('id,display_name').in('id', instIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const cm = new Map((courses ?? []).map((c: any) => [c.id, c.title]));
    const pm = new Map((profs ?? []).map((p: any) => [p.id, p.display_name]));
    setRows(list.map((r) => ({
      ...r,
      targetName: r.scope === 'course' ? cm.get(r.target_id) : pm.get(r.target_id),
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const search = async () => {
    if (!searchQ.trim()) return;
    if (searchType === 'course') {
      const { data } = await supabase.from('courses').select('id, title').ilike('title', `%${searchQ}%`).limit(15);
      setSearchResults((data ?? []).map((c: any) => ({ id: c.id, label: c.title })));
    } else {
      const { data } = await supabase.from('profiles').select('id, display_name').ilike('display_name', `%${searchQ}%`).limit(15);
      setSearchResults((data ?? []).map((p: any) => ({ id: p.id, label: p.display_name ?? '—' })));
    }
  };

  // Impact preview: compute payout impact of the override on a sample $150 course.
  const impact = useMemo(() => {
    const fee = form.platform_fee_cents ? parseInt(form.platform_fee_cents, 10) * 100 : null;
    const feePct = form.platform_fee_pct ? parseFloat(form.platform_fee_pct) / 100 : null;
    const depPct = form.deposit_pct ? parseFloat(form.deposit_pct) / 100 : INSTRUCTOR_COMMISSION_PCT;

    const baseFee = PLATFORM_FEE_CENTS;
    const baseDeposit = Math.round(SAMPLE_PRICE * INSTRUCTOR_COMMISSION_PCT);
    const baseInstructorPayout = SAMPLE_PRICE - baseDeposit; // their in-person take

    const newFee = fee ?? (feePct ? Math.round(SAMPLE_PRICE * feePct) : baseFee);
    const newDeposit = Math.round(SAMPLE_PRICE * depPct);
    const newInstructorPayout = SAMPLE_PRICE - newDeposit;
    const studentOnline = newFee + newDeposit;
    const baseStudentOnline = baseFee + baseDeposit;

    return {
      sample: SAMPLE_PRICE,
      baseFee, baseDeposit, baseInstructorPayout, baseStudentOnline,
      newFee, newDeposit, newInstructorPayout, studentOnline,
      deltaFee: newFee - baseFee,
      deltaPayout: newInstructorPayout - baseInstructorPayout,
    };
  }, [form]);

  const submit = async () => {
    if (!form.target_id) {
      toast({ title: 'Select a target', variant: 'destructive' });
      return;
    }
    const payload: any = {
      scope: form.scope,
      target_id: form.target_id,
      platform_fee_cents: form.platform_fee_cents ? parseInt(form.platform_fee_cents, 10) * 100 : null,
      platform_fee_pct: form.platform_fee_pct ? parseFloat(form.platform_fee_pct) : null,
      deposit_pct: form.deposit_pct ? parseFloat(form.deposit_pct) : null,
      note: form.note || null,
      created_by: user?.id,
    };
    const { error } = await supabase.from('fee_overrides').upsert(payload, { onConflict: 'scope,target_id' });
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    await supabase.rpc('log_admin_action', {
      _action: 'set_fee_override',
      _target_type: form.scope,
      _target_id: form.target_id,
      _before: null,
      _after: payload,
      _reason: form.note ?? null,
      _source: 'admin_ui',
    });
    toast({ title: 'Override saved' });
    setOpen(false);
    setForm({ scope: 'course', target_id: '', platform_fee_cents: '', platform_fee_pct: '', deposit_pct: '', note: '' });
    setSearchResults([]);
    setSearchQ('');
    load();
  };

  const remove = async () => {
    if (!confirmDel) return;
    await supabase.from('fee_overrides').delete().eq('id', confirmDel.id);
    await supabase.rpc('log_admin_action', {
      _action: 'remove_fee_override',
      _target_type: confirmDel.scope,
      _target_id: confirmDel.target_id,
      _before: confirmDel as any,
      _after: null,
      _reason: null,
      _source: 'admin_ui',
    });
    toast({ title: 'Override removed' });
    setConfirmDel(null);
    load();
  };

  return (
    <>
      <AdminHeader
        title="Fee Overrides"
        subtitle="Custom commission or platform fee per course or instructor"
        action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New override</Button>}
      />
      <div className="p-8 space-y-4">
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Scope</th>
                <th className="text-left px-3 py-2">Target</th>
                <th className="text-right px-3 py-2">Platform fee</th>
                <th className="text-right px-3 py-2">Deposit %</th>
                <th className="text-left px-3 py-2">Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No overrides yet.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 uppercase text-xs">{r.scope}</td>
                  <td className="px-3 py-2">{r.targetName ?? r.target_id}</td>
                  <td className="px-3 py-2 text-right">
                    {r.platform_fee_cents ? fmt(r.platform_fee_cents)
                      : r.platform_fee_pct ? `${r.platform_fee_pct}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{r.deposit_pct ? `${r.deposit_pct}%` : '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[280px] truncate">{r.note}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDel(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New fee override</DialogTitle>
            <DialogDescription>
              Defaults: ${PLATFORM_FEE_CENTS / 100} platform fee + {INSTRUCTOR_COMMISSION_PCT * 100}% deposit.
              Leave fields blank to keep defaults.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Scope</Label>
                <Select value={form.scope} onValueChange={(v) => { setForm({ ...form, scope: v as any, target_id: '' }); setSearchType(v as any); setSearchResults([]); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">Specific course</SelectItem>
                    <SelectItem value="instructor">Instructor (all courses)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Find {form.scope}</Label>
                <div className="flex gap-2">
                  <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && search()} placeholder={form.scope === 'course' ? 'course title…' : 'instructor name…'} />
                  <Button variant="outline" onClick={search}>Find</Button>
                </div>
              </div>
            </div>
            {searchResults.length > 0 && !form.target_id && (
              <ul className="border border-border rounded-md max-h-40 overflow-y-auto divide-y divide-border">
                {searchResults.map((r) => (
                  <li key={r.id}>
                    <button className="w-full text-left px-3 py-2 hover:bg-muted/50"
                            onClick={() => { setForm({ ...form, target_id: r.id }); setSearchResults([]); }}>
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {form.target_id && (
              <div className="text-xs text-muted-foreground">Selected: <span className="font-mono">{form.target_id}</span>
                <button onClick={() => setForm({ ...form, target_id: '' })} className="text-primary ml-2">change</button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Platform fee (USD, fixed)</Label>
                <Input type="number" value={form.platform_fee_cents} onChange={(e) => setForm({ ...form, platform_fee_cents: e.target.value, platform_fee_pct: '' })} placeholder="25" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">— or % of price</Label>
                <Input type="number" step="0.1" value={form.platform_fee_pct} onChange={(e) => setForm({ ...form, platform_fee_pct: e.target.value, platform_fee_cents: '' })} placeholder="e.g. 15" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deposit % (commission)</Label>
                <Input type="number" step="0.1" value={form.deposit_pct} onChange={(e) => setForm({ ...form, deposit_pct: e.target.value })} placeholder={`${INSTRUCTOR_COMMISSION_PCT * 100}`} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Promotional rate for partner" />
            </div>

            {/* Impact preview */}
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Projected impact on a $150 course</div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <div className="uppercase text-[10px] tracking-wider text-muted-foreground">Default</div>
                  <div>Student pays online: {fmt(impact.baseStudentOnline)}</div>
                  <div>Platform fee: {fmt(impact.baseFee)}</div>
                  <div>Deposit: {fmt(impact.baseDeposit)}</div>
                  <div>Instructor in-person: {fmt(impact.baseInstructorPayout)}</div>
                </div>
                <div>
                  <div className="uppercase text-[10px] tracking-wider text-primary">With override</div>
                  <div>Student pays online: {fmt(impact.studentOnline)}</div>
                  <div>Platform fee: {fmt(impact.newFee)} <span className={impact.deltaFee >= 0 ? 'text-success' : 'text-destructive'}>({impact.deltaFee >= 0 ? '+' : ''}{fmt(impact.deltaFee)})</span></div>
                  <div>Deposit: {fmt(impact.newDeposit)}</div>
                  <div>Instructor in-person: {fmt(impact.newInstructorPayout)} <span className={impact.deltaPayout >= 0 ? 'text-success' : 'text-destructive'}>({impact.deltaPayout >= 0 ? '+' : ''}{fmt(impact.deltaPayout)})</span></div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Save override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove override?</AlertDialogTitle>
            <AlertDialogDescription>
              The {confirmDel?.scope} will revert to the default platform fee and commission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove(); }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminFeeOverrides;
