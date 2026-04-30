import { useEffect, useMemo, useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, Plus, QrCode, Loader2, Pencil, History, Receipt, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildInfluencerUrl } from '@/lib/influencer';
import { format } from 'date-fns';

type Audience = 'student' | 'instructor' | 'both';

type InfluencerLink = {
  id: string;
  slug: string;
  influencer_name: string;
  influencer_handle: string | null;
  influencer_email: string | null;
  audience: Audience;
  commission_pct: number | null; // legacy, used as fallback for first_booking_pct
  first_booking_pct: number | null;
  recurring_pct: number | null;
  recurring_window_days: number | null;
  active: boolean;
  notes: string | null;
  created_at: string;
};

type SignupCount = { link_id: string; count: number };

const slugify = (raw: string) =>
  raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

const downloadQrPng = (slug: string, displayName: string) => {
  const svg = document.getElementById(`qr-${slug}`) as unknown as SVGSVGElement | null;
  if (!svg) return;
  const xml = new XMLSerializer().serializeToString(svg);
  const svg64 = btoa(unescape(encodeURIComponent(xml)));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const link = document.createElement('a');
    link.download = `taclink-influencer-${slug}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = `data:image/svg+xml;base64,${svg64}`;
  toast.success(`QR for ${displayName} downloaded`);
};

type PctAuditRow = {
  id: string;
  scope: 'link' | 'global_default';
  link_id: string | null;
  old_pct: number | null;
  new_pct: number | null;
  changed_by: string | null;
  reason: string | null;
  effective_at: string;
};

type CommissionRow = {
  id: string;
  link_id: string;
  user_id: string;
  booking_id: string;
  course_price_cents: number;
  pct_at_time: number;
  amount_cents: number;
  status: 'accrued' | 'paid' | 'void';
  commission_kind: 'first' | 'recurring';
  created_at: string;
  updated_at: string;
};

type SlugCheck = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const AdminInfluencerLinks = () => {
  const [links, setLinks] = useState<InfluencerLink[]>([]);
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>({});
  const [defaultFirstPct, setDefaultFirstPct] = useState<number>(5);
  const [defaultRecurringPct, setDefaultRecurringPct] = useState<number>(1);
  const [defaultWindowDays, setDefaultWindowDays] = useState<number>(180);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InfluencerLink | null>(null);
  const [qrFor, setQrFor] = useState<InfluencerLink | null>(null);

  const [pctAudit, setPctAudit] = useState<PctAuditRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);

  // Live payout preview — sample booking amount admins can tweak
  const [previewBookingDollars, setPreviewBookingDollars] = useState<number>(150);

  const [newName, setNewName] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newAudience, setNewAudience] = useState<Audience>('both');
  const [newFirstPct, setNewFirstPct] = useState<string>('');
  const [newRecurringPct, setNewRecurringPct] = useState<string>('');
  const [newWindowDays, setNewWindowDays] = useState<string>('');
  const [newNotes, setNewNotes] = useState('');
  const [slugCheck, setSlugCheck] = useState<SlugCheck>('idle');

  const refresh = async () => {
    setLoading(true);
    const [
      { data: linkRows },
      { data: signupRows },
      { data: settingsRows },
      { data: auditRows },
      { data: commissionRows },
    ] = await Promise.all([
      supabase.from('influencer_links').select('*').order('created_at', { ascending: false }),
      supabase.from('influencer_link_signups').select('link_id'),
      supabase
        .from('platform_settings')
        .select('key,value')
        .in('key', [
          'default_influencer_first_booking_pct',
          'default_influencer_recurring_pct',
          'default_influencer_recurring_window_days',
        ]),
      supabase
        .from('influencer_commission_pct_audit')
        .select('*')
        .order('effective_at', { ascending: false })
        .limit(50),
      supabase
        .from('influencer_commissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    setLinks((linkRows as InfluencerLink[]) ?? []);
    const counts: Record<string, number> = {};
    (signupRows ?? []).forEach((r: any) => {
      counts[r.link_id] = (counts[r.link_id] ?? 0) + 1;
    });
    setSignupCounts(counts);
    (settingsRows ?? []).forEach((row: any) => {
      const n = Number(row.value);
      if (Number.isNaN(n)) return;
      if (row.key === 'default_influencer_first_booking_pct') setDefaultFirstPct(n);
      if (row.key === 'default_influencer_recurring_pct') setDefaultRecurringPct(n);
      if (row.key === 'default_influencer_recurring_window_days') setDefaultWindowDays(n);
    });
    setPctAudit((auditRows as PctAuditRow[]) ?? []);
    setCommissions((commissionRows as CommissionRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  // Live slug availability check (debounced) — uses structured RPC for format + collision validation.
  const previewSlug = useMemo(
    () => slugify(newSlug || newHandle || newName),
    [newSlug, newHandle, newName],
  );
  const [slugError, setSlugError] = useState<string | null>(null);
  useEffect(() => {
    if (!creating) return;
    if (!previewSlug) {
      setSlugCheck('invalid');
      setSlugError(null);
      return;
    }
    setSlugCheck('checking');
    setSlugError(null);
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('check_influencer_slug_available', { _slug: previewSlug });
        if (error) {
          setSlugCheck('idle');
          setSlugError("Couldn't check availability — try again.");
          return;
        }
        const result = data as { ok: boolean; normalized: string | null; reason: string } | null;
        if (!result) {
          setSlugCheck('idle');
          setSlugError('Unexpected response from server.');
          return;
        }
        if (result.ok) {
          setSlugCheck('available');
          return;
        }
        if (result.reason === 'taken') {
          setSlugCheck('taken');
          setSlugError(`"${result.normalized ?? previewSlug}" is already in use.`);
        } else if (result.reason === 'invalid_format') {
          setSlugCheck('invalid');
          setSlugError('Slug must be 2–32 characters, letters/numbers/hyphens only, and not a reserved word (admin, api, login…).');
        } else {
          setSlugCheck('invalid');
          setSlugError('Slug is empty.');
        }
      } catch {
        setSlugCheck('idle');
        setSlugError("Couldn't check availability — try again.");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [previewSlug, creating]);

  const resetCreateForm = () => {
    setNewName('');
    setNewHandle('');
    setNewEmail('');
    setNewSlug('');
    setNewAudience('both');
    setNewFirstPct('');
    setNewRecurringPct('');
    setNewWindowDays('');
    setNewNotes('');
    setSlugCheck('idle');
    setSlugError(null);
  };

  const parseOptionalPct = (raw: string): { ok: boolean; value: number | null } => {
    if (raw.trim() === '') return { ok: true, value: null };
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0 || n > 100) return { ok: false, value: null };
    return { ok: true, value: n };
  };

  const parseOptionalDays = (raw: string): { ok: boolean; value: number | null } => {
    if (raw.trim() === '') return { ok: true, value: null };
    const n = Number(raw);
    if (Number.isNaN(n) || n < 1 || n > 3650 || !Number.isFinite(n)) return { ok: false, value: null };
    return { ok: true, value: Math.floor(n) };
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return toast.error('Influencer name is required');
    const slug = slugify(newSlug || newHandle || name);
    if (!slug) return toast.error('Could not build a slug — add a name or handle');
    if (slugCheck === 'taken') return toast.error(slugError ?? `Slug "${slug}" is already in use`);
    if (slugCheck === 'invalid') return toast.error(slugError ?? 'Slug format is invalid');
    const firstParsed = parseOptionalPct(newFirstPct);
    if (!firstParsed.ok) return toast.error('First-booking % must be between 0 and 100');
    const recurringParsed = parseOptionalPct(newRecurringPct);
    if (!recurringParsed.ok) return toast.error('Recurring % must be between 0 and 100');
    const windowParsed = parseOptionalDays(newWindowDays);
    if (!windowParsed.ok) return toast.error('Recurring window must be between 1 and 3650 days');
    // Final pre-flight check (race-safe — DB unique index + trigger are the real guard).
    const { data: check, error: checkErr } = await supabase
      .rpc('check_influencer_slug_available', { _slug: slug });
    if (checkErr) {
      return toast.error("Couldn't verify slug availability — try again.");
    }
    const result = check as { ok: boolean; normalized: string | null; reason: string } | null;
    if (!result?.ok) {
      if (result?.reason === 'taken') {
        setSlugCheck('taken');
        setSlugError(`"${result.normalized ?? slug}" is already in use.`);
        return toast.error(`Slug "${result.normalized ?? slug}" is already in use`);
      }
      setSlugCheck('invalid');
      setSlugError('Slug format is invalid.');
      return toast.error('Slug format is invalid');
    }
    const finalSlug = result.normalized ?? slug;
    const { error } = await supabase.from('influencer_links').insert({
      slug: finalSlug,
      influencer_name: name,
      influencer_handle: newHandle.trim() || null,
      influencer_email: newEmail.trim() || null,
      audience: newAudience,
      first_booking_pct: firstParsed.value,
      recurring_pct: recurringParsed.value,
      recurring_window_days: windowParsed.value,
      notes: newNotes.trim() || null,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      const dup = msg.includes('duplicate') || error.code === '23505' || msg.includes('idx_influencer_links_slug_lower_uniq');
      const badFormat = msg.includes('invalid_slug_format') || error.code === '22023';
      if (dup) {
        setSlugCheck('taken');
        setSlugError(`"${finalSlug}" is already in use.`);
        toast.error(`Slug "${finalSlug}" is already in use`);
      } else if (badFormat) {
        setSlugCheck('invalid');
        setSlugError('Slug format is invalid.');
        toast.error('Slug format is invalid');
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(`Link /i/${finalSlug} created`);
    setCreating(false);
    resetCreateForm();
    refresh();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const validatePct = (v: number | null, label: string) => {
      if (v === null) return null;
      if (Number.isNaN(v) || v < 0 || v > 100) return `${label} must be between 0 and 100`;
      return null;
    };
    const err =
      validatePct(editing.first_booking_pct, 'First-booking %') ??
      validatePct(editing.recurring_pct, 'Recurring %');
    if (err) return toast.error(err);
    if (editing.recurring_window_days !== null) {
      const w = editing.recurring_window_days;
      if (Number.isNaN(w) || w < 1 || w > 3650) return toast.error('Recurring window must be 1–3650 days');
    }
    const { error } = await supabase
      .from('influencer_links')
      .update({
        influencer_name: editing.influencer_name,
        influencer_handle: editing.influencer_handle,
        influencer_email: editing.influencer_email,
        audience: editing.audience,
        first_booking_pct: editing.first_booking_pct,
        recurring_pct: editing.recurring_pct,
        recurring_window_days: editing.recurring_window_days,
        active: editing.active,
        notes: editing.notes,
      })
      .eq('id', editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Link updated');
    setEditing(null);
    refresh();
  };

  const handleToggleActive = async (link: InfluencerLink) => {
    const { error } = await supabase
      .from('influencer_links')
      .update({ active: !link.active })
      .eq('id', link.id);
    if (error) return toast.error(error.message);
    toast.success(`Link ${!link.active ? 'activated' : 'deactivated'}`);
    refresh();
  };

  const handleSaveDefault = async (
    key:
      | 'default_influencer_first_booking_pct'
      | 'default_influencer_recurring_pct'
      | 'default_influencer_recurring_window_days',
    value: number,
    label: string,
  ) => {
    const isPct = key !== 'default_influencer_recurring_window_days';
    if (Number.isNaN(value)) return toast.error(`${label} must be a number`);
    if (isPct && (value < 0 || value > 100)) return toast.error(`${label} must be between 0 and 100`);
    if (!isPct && (value < 1 || value > 3650)) return toast.error(`${label} must be between 1 and 3650 days`);
    const { error } = await supabase
      .from('platform_settings')
      .update({ value: value as any })
      .eq('key', key);
    if (error) return toast.error(error.message);
    toast.success(`${label} saved`);
    if (key === 'default_influencer_first_booking_pct') setDefaultFirstPct(value);
    if (key === 'default_influencer_recurring_pct') setDefaultRecurringPct(value);
    if (key === 'default_influencer_recurring_window_days') setDefaultWindowDays(value);
    refresh();
  };

  const handleUpdateCommissionStatus = async (id: string, status: 'paid' | 'void' | 'accrued') => {
    const { error } = await supabase
      .from('influencer_commissions')
      .update({ status })
      .eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(`Commission marked ${status}`);
    refresh();
  };

  const linkNameById = useMemo(() => {
    const m: Record<string, string> = {};
    links.forEach((l) => { m[l.id] = l.influencer_name; });
    return m;
  }, [links]);

  const linkSlugById = useMemo(() => {
    const m: Record<string, string> = {};
    links.forEach((l) => { m[l.id] = l.slug; });
    return m;
  }, [links]);

  const totalSignups = useMemo(
    () => Object.values(signupCounts).reduce((a, b) => a + b, 0),
    [signupCounts],
  );

  const totalAccruedCents = useMemo(
    () => commissions.filter((c) => c.status === 'accrued').reduce((s, c) => s + c.amount_cents, 0),
    [commissions],
  );
  const totalPaidCents = useMemo(
    () => commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + c.amount_cents, 0),
    [commissions],
  );

  return (
    <>
      <AdminHeader
        title="Influencer Links"
        subtitle={`${links.length} link${links.length === 1 ? '' : 's'} • ${totalSignups} attributed signup${totalSignups === 1 ? '' : 's'}`}
        action={
          <Button onClick={() => setCreating(true)} className="h-10 bg-primary text-primary-foreground font-bold">
            <Plus className="h-4 w-4 mr-1.5" /> New Link
          </Button>
        }
      />

      <div className="p-4 sm:p-8 space-y-6">
        {/* Default commissions (hybrid) */}
        <div className="tactical-card p-5">
          <div className="space-y-1 mb-4">
            <h2 className="font-bold">Default commissions (hybrid model)</h2>
            <p className="text-xs text-muted-foreground">
              Used for any link without a per-link override. Switch tabs to edit the <span className="font-semibold text-foreground">first-booking</span> rate or the <span className="font-semibold text-foreground">recurring</span> rate &amp; window. Cancelled / no-show bookings never pay out. Past commissions are never re-priced.
            </p>
          </div>
          <Tabs defaultValue="first" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="first">First booking</TabsTrigger>
              <TabsTrigger value="recurring">Recurring</TabsTrigger>
            </TabsList>

            <TabsContent value="first" className="mt-4">
              <div className="rounded-md border border-border p-4 space-y-2 max-w-md">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">First-booking commission %</Label>
                <p className="text-xs text-muted-foreground">
                  Paid the first time a referred user attends a booking. Recommended: 5%.
                </p>
                <div className="flex items-end gap-2 pt-1">
                  <Input
                    type="number" min={0} max={100} step={0.1}
                    value={defaultFirstPct}
                    onChange={(e) => setDefaultFirstPct(Number(e.target.value))}
                    className="bg-background border-border h-11 w-28"
                  />
                  <span className="text-sm text-muted-foreground pb-3">%</span>
                  <Button
                    size="sm"
                    onClick={() => handleSaveDefault('default_influencer_first_booking_pct', defaultFirstPct, 'First-booking %')}
                    className="h-11 bg-primary text-primary-foreground font-bold"
                  >Save</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recurring" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                <div className="rounded-md border border-border p-4 space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recurring commission % (0 = off)</Label>
                  <p className="text-xs text-muted-foreground">
                    Paid on every subsequent attended booking inside the window. Recommended: 1%.
                  </p>
                  <div className="flex items-end gap-2 pt-1">
                    <Input
                      type="number" min={0} max={100} step={0.1}
                      value={defaultRecurringPct}
                      onChange={(e) => setDefaultRecurringPct(Number(e.target.value))}
                      className="bg-background border-border h-11 w-28"
                    />
                    <span className="text-sm text-muted-foreground pb-3">%</span>
                    <Button
                      size="sm"
                      onClick={() => handleSaveDefault('default_influencer_recurring_pct', defaultRecurringPct, 'Recurring %')}
                      className="h-11 bg-primary text-primary-foreground font-bold"
                    >Save</Button>
                  </div>
                </div>
                <div className="rounded-md border border-border p-4 space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recurring window (days)</Label>
                  <p className="text-xs text-muted-foreground">
                    How long after signup recurring commissions accrue. Recommended: 180.
                  </p>
                  <div className="flex items-end gap-2 pt-1">
                    <Input
                      type="number" min={1} max={3650} step={1}
                      value={defaultWindowDays}
                      onChange={(e) => setDefaultWindowDays(Number(e.target.value))}
                      className="bg-background border-border h-11 w-28"
                    />
                    <span className="text-sm text-muted-foreground pb-3">days</span>
                    <Button
                      size="sm"
                      onClick={() => handleSaveDefault('default_influencer_recurring_window_days', defaultWindowDays, 'Recurring window')}
                      className="h-11 bg-primary text-primary-foreground font-bold"
                    >Save</Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Links table */}
        <div className="tactical-card overflow-x-auto">
          {loading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : links.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No influencer links yet. Create one to share with a creator.
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">Influencer</th>
                  <th className="text-left px-4 py-3 font-bold">Link</th>
                  <th className="text-left px-4 py-3 font-bold">Audience</th>
                  <th className="text-left px-4 py-3 font-bold">Commission</th>
                  <th className="text-left px-4 py-3 font-bold">Signups</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-left px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {links.map((l) => {
                  const url = buildInfluencerUrl(l.slug);
                  const firstPct = l.first_booking_pct ?? l.commission_pct ?? defaultFirstPct;
                  const recurringPct = l.recurring_pct ?? defaultRecurringPct;
                  const windowDays = l.recurring_window_days ?? defaultWindowDays;
                  const firstIsDefault = l.first_booking_pct === null && l.commission_pct === null;
                  const recurringIsDefault = l.recurring_pct === null;
                  const windowIsDefault = l.recurring_window_days === null;
                  return (
                    <tr key={l.id} className="hover:bg-muted/30 align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{l.influencer_name}</div>
                        {l.influencer_handle && (
                          <div className="text-xs text-muted-foreground">{l.influencer_handle}</div>
                        )}
                        {l.influencer_email && (
                          <div className="text-xs text-muted-foreground">{l.influencer_email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-primary font-bold break-all">/i/{l.slug}</code>
                        <div className="text-[11px] text-muted-foreground break-all mt-0.5">{url}</div>
                      </td>
                      <td className="px-4 py-3 capitalize">{l.audience}</td>
                      <td className="px-4 py-3 text-xs leading-relaxed">
                        <div>
                          <span className="font-bold text-foreground">{firstPct}%</span> first
                          {firstIsDefault && <span className="text-[10px] text-muted-foreground"> (default)</span>}
                        </div>
                        <div>
                          {recurringPct > 0 ? (
                            <>
                              <span className="font-bold text-foreground">{recurringPct}%</span> recurring · {windowDays}d
                              {(recurringIsDefault || windowIsDefault) && <span className="text-[10px] text-muted-foreground"> (default)</span>}
                            </>
                          ) : (
                            <span className="text-muted-foreground">no recurring</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold">{signupCounts[l.id] ?? 0}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-bold ${l.active ? 'text-success' : 'text-muted-foreground'}`}
                        >
                          {l.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              navigator.clipboard.writeText(url);
                              toast.success('Link copied');
                            }}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setQrFor(l)}
                          >
                            <QrCode className="h-3.5 w-3.5 mr-1" /> QR
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setEditing({ ...l })}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-destructive"
                            onClick={() => handleToggleActive(l)}
                          >
                            {l.active ? 'Disable' : 'Enable'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Commission accrual history */}
        <div className="tactical-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <h2 className="font-bold">Commission accruals</h2>
            </div>
            <div className="text-xs text-muted-foreground">
              Accrued <span className="font-bold text-foreground">${(totalAccruedCents / 100).toFixed(2)}</span>
              {' · '}
              Paid <span className="font-bold text-foreground">${(totalPaidCents / 100).toFixed(2)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            {commissions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No commissions yet. They appear automatically when an attributed booking is marked attended.
              </div>
            ) : (
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">Influencer</th>
                    <th className="text-left px-4 py-3 font-bold">Booking</th>
                    <th className="text-left px-4 py-3 font-bold">Course price</th>
                    <th className="text-left px-4 py-3 font-bold">% at time</th>
                    <th className="text-left px-4 py-3 font-bold">Amount</th>
                    <th className="text-left px-4 py-3 font-bold">Status</th>
                    <th className="text-left px-4 py-3 font-bold">Accrued</th>
                    <th className="text-left px-4 py-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{linkNameById[c.link_id] ?? '—'}</div>
                        <div className="text-[11px] text-muted-foreground">/i/{linkSlugById[c.link_id] ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">{c.booking_id.slice(0, 8)}…</td>
                      <td className="px-4 py-3">${(c.course_price_cents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {Number(c.pct_at_time)}%
                        <span className={`ml-1.5 inline-block px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${c.commission_kind === 'first' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {c.commission_kind ?? 'first'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold">${(c.amount_cents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-bold ${
                            c.status === 'paid' ? 'text-success' : c.status === 'void' ? 'text-muted-foreground' : 'text-primary'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {format(new Date(c.created_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {c.status !== 'paid' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleUpdateCommissionStatus(c.id, 'paid')}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark paid
                            </Button>
                          )}
                          {c.status !== 'void' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              onClick={() => handleUpdateCommissionStatus(c.id, 'void')}
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Void
                            </Button>
                          )}
                          {c.status !== 'accrued' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => handleUpdateCommissionStatus(c.id, 'accrued')}
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Commission % audit log */}
        <div className="tactical-card">
          <div className="flex items-center gap-2 px-5 pt-5 pb-3">
            <History className="h-4 w-4 text-primary" />
            <h2 className="font-bold">Commission % change history</h2>
          </div>
          <div className="overflow-x-auto">
            {pctAudit.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No commission rate changes recorded yet.
              </div>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">Scope</th>
                    <th className="text-left px-4 py-3 font-bold">Target</th>
                    <th className="text-left px-4 py-3 font-bold">Old %</th>
                    <th className="text-left px-4 py-3 font-bold">New %</th>
                    <th className="text-left px-4 py-3 font-bold">Effective</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pctAudit.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-primary">
                          {row.scope === 'global_default' ? 'Global default' : 'Per-link'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.scope === 'link' && row.link_id
                          ? `${linkNameById[row.link_id] ?? 'Deleted link'} (/i/${linkSlugById[row.link_id] ?? '—'})`
                          : 'Platform default'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.old_pct === null ? '—' : `${Number(row.old_pct)}%`}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {row.new_pct === null ? 'unset' : `${Number(row.new_pct)}%`}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {format(new Date(row.effective_at), 'MMM d, yyyy h:mm a')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={(o) => { setCreating(o); if (!o) resetCreateForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New influencer link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Influencer name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-background border-border h-11 mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Handle</Label>
                <Input value={newHandle} onChange={(e) => setNewHandle(e.target.value)} placeholder="@ashley" className="bg-background border-border h-11 mt-1.5" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="bg-background border-border h-11 mt-1.5" />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Custom slug</Label>
              <Input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder={slugify(newHandle || newName) || 'auto'}
                className={`bg-background h-11 mt-1.5 font-mono ${
                  slugCheck === 'taken' || slugCheck === 'invalid'
                    ? 'border-destructive focus-visible:ring-destructive'
                    : slugCheck === 'available'
                    ? 'border-success'
                    : 'border-border'
                }`}
              />
              <p className="text-[11px] mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-muted-foreground">URL:</span>
                <code>/i/{previewSlug || 'slug'}</code>
                {previewSlug && slugCheck === 'checking' && (
                  <span className="text-muted-foreground">· checking…</span>
                )}
                {previewSlug && slugCheck === 'available' && (
                  <span className="text-success font-bold">· available</span>
                )}
                {previewSlug && slugCheck === 'taken' && (
                  <span className="text-destructive font-bold">· already in use</span>
                )}
                {slugCheck === 'invalid' && (
                  <span className="text-destructive font-bold">· invalid format</span>
                )}
              </p>
              {slugError && (
                <p className="text-[11px] mt-1 text-destructive">{slugError}</p>
              )}
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Audience</Label>
              <Select value={newAudience} onValueChange={(v) => setNewAudience(v as Audience)}>
                <SelectTrigger className="bg-background border-border h-11 mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both (chooser)</SelectItem>
                  <SelectItem value="student">Students only</SelectItem>
                  <SelectItem value="instructor">Instructors only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">First %</Label>
                <Input
                  type="number" min={0} max={100} step={0.1}
                  value={newFirstPct}
                  onChange={(e) => setNewFirstPct(e.target.value)}
                  placeholder={`${defaultFirstPct}`}
                  className="bg-background border-border h-11 mt-1.5"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Recurring %</Label>
                <Input
                  type="number" min={0} max={100} step={0.1}
                  value={newRecurringPct}
                  onChange={(e) => setNewRecurringPct(e.target.value)}
                  placeholder={`${defaultRecurringPct}`}
                  className="bg-background border-border h-11 mt-1.5"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Window (days)</Label>
                <Input
                  type="number" min={1} max={3650} step={1}
                  value={newWindowDays}
                  onChange={(e) => setNewWindowDays(e.target.value)}
                  placeholder={`${defaultWindowDays}`}
                  className="bg-background border-border h-11 mt-1.5"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Leave blank to inherit the platform defaults. Set Recurring % to 0 to disable recurring for this link.
            </p>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="bg-background border-border min-h-20 mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); resetCreateForm(); }}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={slugCheck === 'taken' || slugCheck === 'invalid' || slugCheck === 'checking' || !newName.trim()}
              className="bg-primary text-primary-foreground font-bold"
            >
              Create link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit /i/{editing?.slug}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Influencer name</Label>
                <Input
                  value={editing.influencer_name}
                  onChange={(e) => setEditing({ ...editing, influencer_name: e.target.value })}
                  className="bg-background border-border h-11 mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Handle</Label>
                  <Input
                    value={editing.influencer_handle ?? ''}
                    onChange={(e) => setEditing({ ...editing, influencer_handle: e.target.value })}
                    className="bg-background border-border h-11 mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={editing.influencer_email ?? ''}
                    onChange={(e) => setEditing({ ...editing, influencer_email: e.target.value })}
                    className="bg-background border-border h-11 mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Audience</Label>
                <Select value={editing.audience} onValueChange={(v) => setEditing({ ...editing, audience: v as Audience })}>
                  <SelectTrigger className="bg-background border-border h-11 mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both (chooser)</SelectItem>
                    <SelectItem value="student">Students only</SelectItem>
                    <SelectItem value="instructor">Instructors only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">First %</Label>
                  <Input
                    type="number" min={0} max={100} step={0.1}
                    value={editing.first_booking_pct ?? editing.commission_pct ?? ''}
                    onChange={(e) => setEditing({ ...editing, first_booking_pct: e.target.value === '' ? null : Number(e.target.value), commission_pct: null })}
                    placeholder={`${defaultFirstPct}`}
                    className="bg-background border-border h-11 mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Recurring %</Label>
                  <Input
                    type="number" min={0} max={100} step={0.1}
                    value={editing.recurring_pct ?? ''}
                    onChange={(e) => setEditing({ ...editing, recurring_pct: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder={`${defaultRecurringPct}`}
                    className="bg-background border-border h-11 mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Window (days)</Label>
                  <Input
                    type="number" min={1} max={3650} step={1}
                    value={editing.recurring_window_days ?? ''}
                    onChange={(e) => setEditing({ ...editing, recurring_window_days: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder={`${defaultWindowDays}`}
                    className="bg-background border-border h-11 mt-1.5"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Blank = inherit platform default. Recurring % = 0 disables recurring for this link.
              </p>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
                <Textarea
                  value={editing.notes ?? ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="bg-background border-border min-h-20 mt-1.5"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Active</span>
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} className="bg-primary text-primary-foreground font-bold">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR dialog */}
      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{qrFor?.influencer_name}</DialogTitle>
          </DialogHeader>
          {qrFor && (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-md">
                <QRCodeSVG id={`qr-${qrFor.slug}`} value={buildInfluencerUrl(qrFor.slug)} size={220} level="M" />
              </div>
              <div className="text-center text-xs">
                <code className="text-primary font-bold">{buildInfluencerUrl(qrFor.slug)}</code>
              </div>
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(buildInfluencerUrl(qrFor.slug));
                    toast.success('Link copied');
                  }}
                >
                  <Copy className="h-4 w-4 mr-1.5" /> Copy link
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground font-bold"
                  onClick={() => downloadQrPng(qrFor.slug, qrFor.influencer_name)}
                >
                  <Download className="h-4 w-4 mr-1.5" /> Download QR
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminInfluencerLinks;
