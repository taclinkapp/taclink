import { useEffect, useMemo, useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { fmt } from '@/lib/fees';
import { DollarSign, Gift, Loader2, TrendingUp, Users } from 'lucide-react';
import { useGrantCredit } from '@/hooks/useAdminData';

type Range = '7d' | '30d' | '90d' | 'all';

const sinceFor = (r: Range) => {
  if (r === 'all') return null;
  const d = new Date();
  const days = r === '7d' ? 7 : r === '30d' ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

export const AdminFinancials = () => {
  const [range, setRange] = useState<Range>('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    platformFees: 0,
    deposits: 0,
    inPerson: 0,
    refunds: 0,
    bookings: 0,
    instructorPayouts: 0,
    creditsGranted: 0,
  });
  const [topInstructors, setTopInstructors] = useState<Array<{ id: string; name: string; revenue: number; bookings: number; payout: number }>>([]);

  const load = async () => {
    setLoading(true);
    const since = sinceFor(range);
    let bq: any = supabase.from('booking_fees').select('platform_fee_cents, instructor_deposit_cents, due_in_person_cents, instructor_id, course_price_cents');
    if (since) bq = bq.gte('created_at', since);
    const creditsQ = since
      ? supabase.from('instructor_credits').select('id', { count: 'exact', head: true }).gte('earned_at', since)
      : supabase.from('instructor_credits').select('id', { count: 'exact', head: true });
    const [{ data: fees }, refundsRes, bookingsCount, creditsCount] = await Promise.all([
      bq,
      since
        ? supabase.from('refunds').select('amount_cents').eq('status', 'issued').gte('created_at', since)
        : supabase.from('refunds').select('amount_cents').eq('status', 'issued'),
      since
        ? supabase.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', since)
        : supabase.from('bookings').select('id', { count: 'exact', head: true }),
      creditsQ,
    ]);

    const rows = fees ?? [];
    const platformFees = rows.reduce((s, r: any) => s + (r.platform_fee_cents ?? 0), 0);
    const deposits = rows.reduce((s, r: any) => s + (r.instructor_deposit_cents ?? 0), 0);
    const inPerson = rows.reduce((s, r: any) => s + (r.due_in_person_cents ?? 0), 0);
    const refunds = (refundsRes.data ?? []).reduce((s, r: any) => s + (r.amount_cents ?? 0), 0);
    // Instructor payout = course price - platform fee they would owe (deposit is held back).
    // Simpler model used in this project: instructor receives `due_in_person_cents` directly.
    const instructorPayouts = inPerson;

    // Top instructors by revenue (platform fee proxy) + their payout
    const grouped = new Map<string, { revenue: number; bookings: number; payout: number }>();
    rows.forEach((r: any) => {
      const cur = grouped.get(r.instructor_id) ?? { revenue: 0, bookings: 0, payout: 0 };
      cur.revenue += (r.platform_fee_cents ?? 0) + (r.instructor_deposit_cents ?? 0);
      cur.payout += (r.due_in_person_cents ?? 0);
      cur.bookings += 1;
      grouped.set(r.instructor_id, cur);
    });
    const topIds = Array.from(grouped.entries()).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
    const ids = topIds.map(([id]) => id);
    const { data: profs } = ids.length
      ? await supabase.from('profiles').select('id,display_name').in('id', ids)
      : { data: [] as any[] };
    const nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.display_name]));
    setTopInstructors(topIds.map(([id, v]) => ({ id, name: nameMap.get(id) ?? 'Instructor', ...v })));

    setStats({
      platformFees,
      deposits,
      inPerson,
      refunds,
      bookings: bookingsCount.count ?? 0,
      instructorPayouts,
      creditsGranted: creditsCount.count ?? 0,
    });
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  const netRevenue = useMemo(() => stats.platformFees - stats.refunds, [stats]);

  return (
    <>
      <AdminHeader
        title="Financial Controls"
        subtitle="Revenue, refund credits, and manual credits"
        action={
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="p-8 space-y-6">
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4">
              <Stat icon={DollarSign} label="Platform Fees" value={fmt(stats.platformFees)} primary />
              <Stat icon={TrendingUp} label="Net Revenue" value={fmt(netRevenue)} />
              <Stat icon={DollarSign} label="Refunds Issued" value={fmt(stats.refunds)} alert />
              <Stat icon={Users} label="Bookings" value={String(stats.bookings)} />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <Stat icon={DollarSign} label="Deposits Collected" value={fmt(stats.deposits)} />
              <Stat icon={DollarSign} label="In-Person Owed" value={fmt(stats.inPerson)} />
              <Stat icon={DollarSign} label="Instructor Payouts" value={fmt(stats.instructorPayouts)} />
              <Stat icon={DollarSign} label="GMV" value={fmt(stats.platformFees + stats.deposits + stats.inPerson)} />
            </div>

            <GrantCreditCard />

            <div className="tactical-card p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Top instructors by revenue</h2>
              {topInstructors.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data in this range.</div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left py-1">Instructor</th>
                      <th className="text-right py-1">Bookings</th>
                      <th className="text-right py-1">Platform revenue</th>
                      <th className="text-right py-1">Their payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topInstructors.map((t) => (
                      <tr key={t.id} className="border-t border-border">
                        <td className="py-2">{t.name}</td>
                        <td className="py-2 text-right">{t.bookings}</td>
                        <td className="py-2 text-right font-semibold">{fmt(t.revenue)}</td>
                        <td className="py-2 text-right text-muted-foreground">{fmt(t.payout)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};

function Stat({ icon: Icon, label, value, primary, alert }: any) {
  return (
    <div className={`tactical-card p-5 ${primary ? 'border-primary/40' : ''}`}>
      <Icon className={`h-5 w-5 mb-3 ${primary ? 'text-primary' : alert ? 'text-destructive' : 'text-muted-foreground'}`} />
      <div className={`text-2xl font-black ${primary ? 'text-primary' : ''}`}>{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function GrantCreditCard() {
  const grant = useGrantCredit();
  const [userType, setUserType] = useState<'student' | 'instructor'>('student');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Array<{ id: string; display_name: string }>>([]);
  const [picked, setPicked] = useState<{ id: string; display_name: string } | null>(null);
  const [note, setNote] = useState('');
  const [searching, setSearching] = useState(false);

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles').select('id, display_name')
      .ilike('display_name', `%${search.trim()}%`).limit(15);
    setResults(data ?? []);
    setSearching(false);
  };

  return (
    <div className="tactical-card p-6 space-y-4">
      <div>
        <h2 className="font-bold flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> Grant manual credit</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Issue a free booking (student) or free listing fee (instructor). Logged in audit trail.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">User type</Label>
          <Select value={userType} onValueChange={(v) => { setUserType(v as any); setPicked(null); setResults([]); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student (free booking)</SelectItem>
              <SelectItem value="instructor">Instructor (free listing fee)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Find user</Label>
          <div className="flex gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="display name…"
                   onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
            <Button variant="outline" onClick={doSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>
        </div>
      </div>
      {picked ? (
        <div className="rounded-md border border-border p-3 bg-muted/30 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">{picked.display_name}</div>
            <div className="text-[11px] text-muted-foreground">{picked.id}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Change</Button>
        </div>
      ) : results.length > 0 ? (
        <ul className="border border-border rounded-md max-h-48 overflow-y-auto divide-y divide-border">
          {results.map((u) => (
            <li key={u.id}>
              <button className="w-full text-left px-3 py-2 hover:bg-muted/50" onClick={() => setPicked(u)}>
                <div className="font-medium text-sm">{u.display_name ?? '—'}</div>
                <div className="text-[11px] text-muted-foreground">{u.id}</div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="space-y-1">
        <Label className="text-xs">Note / reason (optional)</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Goodwill credit after support issue" />
      </div>
      <Button
        disabled={!picked || grant.isPending}
        onClick={() => picked && grant.mutate(
          { userType, userId: picked.id, note: note || undefined },
          { onSuccess: () => { setPicked(null); setNote(''); setSearch(''); setResults([]); } },
        )}
        className="bg-primary text-primary-foreground font-bold"
      >
        {grant.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
        Grant credit
      </Button>
    </div>
  );
}

export default AdminFinancials;
