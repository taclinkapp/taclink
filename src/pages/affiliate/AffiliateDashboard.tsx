import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { buildInfluencerUrl } from '@/lib/influencer';
import {
  ALT_PAYOUT_META,
  validatePayoutHandle,
  normalizePayoutHandle,
  type AltPayoutType,
} from '@/lib/payoutHandleValidation';

type Link = {
  id: string;
  slug: string;
  influencer_name: string;
  is_vip: boolean;
  active: boolean;
  payout_method: string | null;
  payout_handle: string | null;
  payout_notes: string | null;
};

type Commission = {
  id: string;
  link_id: string;
  booking_id: string;
  amount_cents: number;
  pct_at_time: number;
  status: 'accrued' | 'paid' | 'void';
  commission_kind: string;
  created_at: string;
  payout_id: string | null;
};

type Payout = {
  id: string;
  link_id: string;
  amount_cents: number;
  method: string;
  reference: string | null;
  notes: string | null;
  paid_at: string;
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const PAYOUT_METHODS: { value: AltPayoutType | 'other'; label: string }[] = [
  { value: 'cashapp', label: 'Cash App' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'other', label: 'Other (see notes)' },
];

const AffiliateDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<Link[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>({});

  // Editable payout handle (per-link)
  const [editLinkId, setEditLinkId] = useState<string | null>(null);
  const [editMethod, setEditMethod] = useState<string>('cashapp');
  const [editHandle, setEditHandle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: linkRows }, { data: comRows }, { data: payRows }, { data: signupRows }] =
        await Promise.all([
          (supabase as any).rpc('get_my_affiliate_links'),

          supabase
            .from('influencer_commissions')
            .select('id,link_id,booking_id,amount_cents,pct_at_time,status,commission_kind,created_at,payout_id')
            .order('created_at', { ascending: false }),
          supabase
            .from('influencer_payouts')
            .select('*')
            .order('paid_at', { ascending: false }),
          supabase.from('influencer_link_signups').select('link_id'),
        ]);
      setLinks((linkRows as Link[]) ?? []);
      setCommissions((comRows as Commission[]) ?? []);
      setPayouts((payRows as Payout[]) ?? []);
      const counts: Record<string, number> = {};
      (signupRows ?? []).forEach((r: any) => {
        counts[r.link_id] = (counts[r.link_id] ?? 0) + 1;
      });
      setSignupCounts(counts);
      setLoading(false);
    })();
  }, [user]);

  const totals = useMemo(() => {
    let accrued = 0, paid = 0, lifetime = 0;
    for (const c of commissions) {
      if (c.status === 'void') continue;
      lifetime += c.amount_cents;
      if (c.status === 'accrued') accrued += c.amount_cents;
      if (c.status === 'paid') paid += c.amount_cents;
    }
    return { accrued, paid, lifetime };
  }, [commissions]);

  const openEdit = (link: Link) => {
    setEditLinkId(link.id);
    setEditMethod(link.payout_method ?? 'cashapp');
    setEditHandle(link.payout_handle ?? '');
    setEditNotes(link.payout_notes ?? '');
  };

  const savePayoutHandle = async () => {
    if (!editLinkId) return;
    let method = editMethod;
    let handle = editHandle.trim();
    if (method !== 'other') {
      const err = validatePayoutHandle(method as AltPayoutType, handle);
      if (err) return toast.error(err);
      handle = normalizePayoutHandle(method as AltPayoutType, handle);
    } else if (!handle && !editNotes.trim()) {
      return toast.error('Add a handle or notes so we know how to pay you');
    }
    setSaving(true);
    const { error } = await supabase
      .from('influencer_links')
      .update({
        payout_method: method,
        payout_handle: handle || null,
        payout_notes: editNotes.trim() || null,
      })
      .eq('id', editLinkId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Payout details saved');
    setLinks((prev) =>
      prev.map((l) =>
        l.id === editLinkId
          ? { ...l, payout_method: method, payout_handle: handle || null, payout_notes: editNotes.trim() || null }
          : l,
      ),
    );
    setEditLinkId(null);
  };

  if (authLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/auth/signin?next=/affiliate" replace />;
  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (links.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold">Affiliate dashboard</h1>
        <p className="text-muted-foreground">
          Your account isn't linked to an affiliate link yet. If you're expecting a partnership,
          contact the team and we'll attach your link to this account.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Affiliate dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Track signups, commissions, and payouts from your TacLink referral links.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unpaid (accrued)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{fmt(totals.accrued)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Paid out</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{fmt(totals.paid)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Lifetime earned</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{fmt(totals.lifetime)}</div></CardContent>
        </Card>
      </div>

      {/* Links + payout handle */}
      <Card>
        <CardHeader><CardTitle>Your links</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {links.map((link) => {
            const url = buildInfluencerUrl(link.slug);
            const isEditing = editLinkId === link.id;
            const methodMeta = link.payout_method && link.payout_method !== 'other'
              ? ALT_PAYOUT_META[link.payout_method as AltPayoutType]
              : null;
            return (
              <div key={link.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold">{link.influencer_name}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <code className="text-xs">{url}</code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          toast.success('Link copied');
                        }}
                        className="inline-flex"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {link.is_vip && <Badge variant="secondary">VIP</Badge>}
                    {!link.active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Signups attributed: <span className="font-medium text-foreground">{signupCounts[link.id] ?? 0}</span>
                </div>

                {!isEditing ? (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Payout method: </span>
                      {link.payout_method ? (
                        <span className="font-medium">
                          {PAYOUT_METHODS.find((m) => m.value === link.payout_method)?.label}
                          {link.payout_handle ? ` · ${link.payout_handle}` : ''}
                        </span>
                      ) : (
                        <span className="text-destructive">Not set — add one so we can pay you</span>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openEdit(link)}>
                      {link.payout_method ? 'Edit' : 'Add payout method'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 border-t">
                    <div>
                      <Label>Payout method</Label>
                      <Select value={editMethod} onValueChange={setEditMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYOUT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {editMethod !== 'other' && (
                      <div>
                        <Label>{ALT_PAYOUT_META[editMethod as AltPayoutType].label} handle</Label>
                        <Input
                          value={editHandle}
                          placeholder={ALT_PAYOUT_META[editMethod as AltPayoutType].placeholder}
                          onChange={(e) => setEditHandle(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {ALT_PAYOUT_META[editMethod as AltPayoutType].hint}
                        </p>
                      </div>
                    )}
                    <div>
                      <Label>Notes (optional)</Label>
                      <Textarea
                        value={editNotes}
                        rows={2}
                        placeholder="Any extra info for the team (e.g. preferred day, bank routing if Other)"
                        onChange={(e) => setEditNotes(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={savePayoutHandle} disabled={saving}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditLinkId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Commissions */}
      <Card>
        <CardHeader><CardTitle>Commissions</CardTitle></CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commissions yet. They'll appear here when an attributed signup attends a booking.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{format(new Date(c.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="capitalize">{c.commission_kind}</TableCell>
                    <TableCell>{c.pct_at_time}%</TableCell>
                    <TableCell>{fmt(c.amount_cents)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'paid' ? 'default' : c.status === 'void' ? 'outline' : 'secondary'}>
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payouts */}
      <Card>
        <CardHeader><CardTitle>Payout history</CardTitle></CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payouts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paid on</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{format(new Date(p.paid_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="capitalize">{p.method}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.reference ?? '—'}</TableCell>
                    <TableCell className="font-medium">{fmt(p.amount_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliateDashboard;
