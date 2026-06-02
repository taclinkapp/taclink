import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { buildInfluencerUrl } from '@/lib/influencer';
import {
  ALT_PAYOUT_META,
  validatePayoutHandle,
  normalizePayoutHandle,
  type AltPayoutType,
} from '@/lib/payoutHandleValidation';
import { Logo } from '@/components/Logo';

const PAYOUT_METHODS: { value: AltPayoutType | 'other'; label: string }[] = [
  { value: 'cashapp', label: 'Cash App' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'other', label: 'Other (see notes)' },
];

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type Commission = {
  id: string;
  amount_cents: number;
  pct_at_time: number;
  status: string;
  commission_kind: string;
  created_at: string;
};

type Payout = {
  id: string;
  amount_cents: number;
  method: string;
  reference: string | null;
  notes: string | null;
  paid_at: string;
};

type LinkInfo = {
  id: string;
  slug: string;
  influencer_name: string;
  influencer_email: string | null;
  audience: string;
  active: boolean;
  is_vip: boolean;
  vip_pct: number | null;
  vip_duration_days: number | null;
  vip_starts_at: string | null;
  first_booking_pct: number | null;
  recurring_pct: number | null;
  recurring_window_days: number | null;
  payout_method: string | null;
  payout_handle: string | null;
  payout_notes: string | null;
};

const vipRemainingDays = (l: LinkInfo): number | null => {
  if (!l.is_vip || l.vip_duration_days === null) return null;
  const start = new Date(l.vip_starts_at ?? Date.now()).getTime();
  const end = start + l.vip_duration_days * 86400_000;
  const remaining = Math.ceil((end - Date.now()) / 86400_000);
  return Math.max(0, remaining);
};

const AffiliatePortal = () => {
  const [slug, setSlug] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [link, setLink] = useState<LinkInfo | null>(null);
  const [signupCount, setSignupCount] = useState(0);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const [editingPayout, setEditingPayout] = useState(false);
  const [editMethod, setEditMethod] = useState<string>('cashapp');
  const [editHandle, setEditHandle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    const cleanPin = pin.trim().toUpperCase();
    if (!cleanSlug || !cleanPin) return;
    setLoading(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc('get_guest_affiliate_stats', {
      _slug: cleanSlug,
      _pin: cleanPin,
    });
    setLoading(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    const result = data as { ok: boolean; error?: string; link?: LinkInfo; signup_count?: number; commissions?: Commission[]; payouts?: Payout[] } | null;
    if (!result?.ok) {
      setError(result?.error ?? 'Invalid slug or PIN');
      return;
    }
    setLink(result.link ?? null);
    setSignupCount(result.signup_count ?? 0);
    setCommissions(result.commissions ?? []);
    setPayouts(result.payouts ?? []);
  };

  const openEditPayout = () => {
    if (!link) return;
    setEditingPayout(true);
    setEditMethod(link.payout_method ?? 'cashapp');
    setEditHandle(link.payout_handle ?? '');
    setEditNotes(link.payout_notes ?? '');
  };

  const savePayout = async () => {
    const cleanSlug = slug.trim().toLowerCase();
    const cleanPin = pin.trim().toUpperCase();
    let method = editMethod;
    let handle = editHandle.trim();
    if (method !== 'other') {
      const err = validatePayoutHandle(method as AltPayoutType, handle);
      if (err) return toast.error(err);
      handle = normalizePayoutHandle(method as AltPayoutType, handle);
    } else if (!handle && !editNotes.trim()) {
      return toast.error('Add a handle or notes so we know how to pay you');
    }
    setSavingPayout(true);
    const { data, error: rpcErr } = await supabase.rpc('update_guest_affiliate_payout', {
      _slug: cleanSlug,
      _pin: cleanPin,
      _method: method,
      _handle: handle || '',
      _notes: editNotes.trim() || null,
    });
    setSavingPayout(false);
    if (rpcErr) {
      toast.error(rpcErr.message);
      return;
    }
    if (!data) {
      toast.error('Invalid slug or PIN');
      return;
    }
    toast.success('Payout details saved');
    setLink((prev) =>
      prev
        ? { ...prev, payout_method: method, payout_handle: handle || null, payout_notes: editNotes.trim() || null }
        : null,
    );
    setEditingPayout(false);
  };

  const totals = (() => {
    let accrued = 0, paid = 0, lifetime = 0;
    for (const c of commissions) {
      if (c.status === 'void') continue;
      lifetime += c.amount_cents;
      if (c.status === 'accrued') accrued += c.amount_cents;
      if (c.status === 'paid') paid += c.amount_cents;
    }
    return { accrued, paid, lifetime };
  })();

  if (!link) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="max-w-md mx-auto w-full px-6 py-12 flex-1 flex flex-col justify-center">
          <div className="text-center mb-8">
            <Logo widthPx={160} showTagline />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Affiliate Portal</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLookup} className="space-y-4">
                <div>
                  <Label htmlFor="portal-slug">Link slug</Label>
                  <Input
                    id="portal-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="your-slug"
                    className="mt-1.5"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="portal-pin">Access PIN</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="portal-pin"
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.toUpperCase())}
                      placeholder="XXXXXX"
                      maxLength={6}
                      className="pr-10 uppercase tracking-widest"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      tabIndex={-1}
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={loading || !slug.trim() || !pin.trim()} className="w-full bg-primary text-primary-foreground font-bold">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  View Stats
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-muted-foreground mt-6">
            No account needed. Enter the slug and PIN the team gave you.
          </p>
        </div>
      </div>
    );
  }

  const url = buildInfluencerUrl(link.slug);
  const vipRemaining = vipRemainingDays(link);
  const vipExpired = link.is_vip && vipRemaining === 0;
  const firstPct = link.first_booking_pct ?? 5;
  const recurringPct = link.recurring_pct ?? 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setLink(null); setError(null); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold">{link.influencer_name}</h1>
          <p className="text-sm text-muted-foreground">
            Affiliate stats for <code className="text-primary font-bold">/i/{link.slug}</code>
          </p>
          {!link.active && (
            <Badge variant="outline" className="mt-2">Inactive</Badge>
          )}
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

        <Card>
          <CardHeader><CardTitle>Link details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">URL:</span>
              <code className="text-xs break-all">{url}</code>
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
            <div className="text-sm">
              <span className="text-muted-foreground">Signups attributed: </span>
              <span className="font-medium">{signupCount}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Audience: </span>
              <span className="capitalize font-medium">{link.audience}</span>
            </div>
            {link.is_vip && !vipExpired ? (
              <div className="text-sm">
                <span className="text-muted-foreground">VIP rate: </span>
                <span className="font-bold text-primary">{link.vip_pct}%</span>
                <span className="text-xs text-muted-foreground ml-1">
                  {vipRemaining === null ? '(unlimited until disabled)' : `(${vipRemaining} days remaining)`}
                </span>
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">First booking: </span>
                  <span className="font-medium">{firstPct}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Recurring: </span>
                  <span className="font-medium">{recurringPct > 0 ? `${recurringPct}%` : 'Disabled'}</span>
                  {recurringPct > 0 && link.recurring_window_days && (
                    <span className="text-xs text-muted-foreground ml-1">(within {link.recurring_window_days} days of signup)</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payout method</CardTitle>
          </CardHeader>
          <CardContent>
            {!editingPayout ? (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm">
                  {link.payout_method ? (
                    <span className="font-medium">
                      {PAYOUT_METHODS.find((m) => m.value === link.payout_method)?.label}
                      {link.payout_handle ? ` · ${link.payout_handle}` : ''}
                    </span>
                  ) : (
                    <span className="text-destructive">Not set — add one so we can pay you</span>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={openEditPayout}>
                  {link.payout_method ? 'Edit' : 'Add payout method'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
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
                    placeholder="Any extra info for the team"
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={savePayout} disabled={savingPayout}>
                    {savingPayout ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingPayout(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Commissions</CardTitle></CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No commissions yet. They appear when an attributed signup attends a booking.</p>
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
    </div>
  );
};

export default AffiliatePortal;
