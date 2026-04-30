import { useEffect, useMemo, useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  commission_pct: number | null;
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
  created_at: string;
  updated_at: string;
};

type SlugCheck = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const AdminInfluencerLinks = () => {
  const [links, setLinks] = useState<InfluencerLink[]>([]);
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>({});
  const [defaultPct, setDefaultPct] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InfluencerLink | null>(null);
  const [qrFor, setQrFor] = useState<InfluencerLink | null>(null);

  const [pctAudit, setPctAudit] = useState<PctAuditRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);

  const [newName, setNewName] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newAudience, setNewAudience] = useState<Audience>('both');
  const [newPct, setNewPct] = useState<string>('');
  const [newNotes, setNewNotes] = useState('');
  const [slugCheck, setSlugCheck] = useState<SlugCheck>('idle');

  const refresh = async () => {
    setLoading(true);
    const [{ data: linkRows }, { data: signupRows }, { data: setting }] = await Promise.all([
      supabase.from('influencer_links').select('*').order('created_at', { ascending: false }),
      supabase.from('influencer_link_signups').select('link_id'),
      supabase.from('platform_settings').select('value').eq('key', 'default_influencer_commission_pct').maybeSingle(),
    ]);
    setLinks((linkRows as InfluencerLink[]) ?? []);
    const counts: Record<string, number> = {};
    (signupRows ?? []).forEach((r: any) => {
      counts[r.link_id] = (counts[r.link_id] ?? 0) + 1;
    });
    setSignupCounts(counts);
    if (setting?.value !== undefined && setting?.value !== null) {
      const n = Number(setting.value);
      if (!Number.isNaN(n)) setDefaultPct(n);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const resetCreateForm = () => {
    setNewName('');
    setNewHandle('');
    setNewEmail('');
    setNewSlug('');
    setNewAudience('both');
    setNewPct('');
    setNewNotes('');
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return toast.error('Influencer name is required');
    const slug = slugify(newSlug || newHandle || name);
    if (!slug) return toast.error('Could not build a slug — add a name or handle');
    const pct = newPct.trim() === '' ? null : Number(newPct);
    if (pct !== null && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      return toast.error('Commission % must be between 0 and 100');
    }
    const { error } = await supabase.from('influencer_links').insert({
      slug,
      influencer_name: name,
      influencer_handle: newHandle.trim() || null,
      influencer_email: newEmail.trim() || null,
      audience: newAudience,
      commission_pct: pct,
      notes: newNotes.trim() || null,
    });
    if (error) {
      toast.error(error.message.includes('duplicate') ? `Slug "${slug}" is already taken` : error.message);
      return;
    }
    toast.success(`Link /i/${slug} created`);
    setCreating(false);
    resetCreateForm();
    refresh();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const pct = editing.commission_pct;
    if (pct !== null && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      return toast.error('Commission % must be between 0 and 100');
    }
    const { error } = await supabase
      .from('influencer_links')
      .update({
        influencer_name: editing.influencer_name,
        influencer_handle: editing.influencer_handle,
        influencer_email: editing.influencer_email,
        audience: editing.audience,
        commission_pct: editing.commission_pct,
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

  const handleSaveDefaultPct = async (value: number) => {
    if (Number.isNaN(value) || value < 0 || value > 100) {
      toast.error('Commission % must be between 0 and 100');
      return;
    }
    const { error } = await supabase
      .from('platform_settings')
      .update({ value: value as any })
      .eq('key', 'default_influencer_commission_pct');
    if (error) return toast.error(error.message);
    toast.success(`Default commission set to ${value}%`);
    setDefaultPct(value);
  };

  const totalSignups = useMemo(
    () => Object.values(signupCounts).reduce((a, b) => a + b, 0),
    [signupCounts],
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
        {/* Default commission */}
        <div className="tactical-card p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[220px]">
              <h2 className="font-bold mb-1">Default commission</h2>
              <p className="text-xs text-muted-foreground">
                Applied to every link that has no per-link override. Captured at the moment a booking is attended — past
                commissions never change.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">% of course price</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={defaultPct}
                  onChange={(e) => setDefaultPct(Number(e.target.value))}
                  className="bg-background border-border h-11 mt-1.5 w-28"
                />
              </div>
              <Button
                onClick={() => handleSaveDefaultPct(defaultPct)}
                className="h-11 bg-primary text-primary-foreground font-bold"
              >
                Save
              </Button>
            </div>
          </div>
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
                  const pct = l.commission_pct ?? defaultPct;
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
                      <td className="px-4 py-3">
                        {pct}%{l.commission_pct === null && <span className="text-[10px] text-muted-foreground"> (default)</span>}
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
                className="bg-background border-border h-11 mt-1.5 font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                URL: <code>/i/{slugify(newSlug || newHandle || newName) || 'slug'}</code>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Commission % <span className="normal-case text-[10px]">(blank = {defaultPct}%)</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={newPct}
                  onChange={(e) => setNewPct(e.target.value)}
                  placeholder={`${defaultPct}`}
                  className="bg-background border-border h-11 mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="bg-background border-border min-h-20 mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); resetCreateForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-primary text-primary-foreground font-bold">Create link</Button>
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
              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Commission % <span className="normal-case text-[10px]">(blank = default)</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={editing.commission_pct ?? ''}
                    onChange={(e) => setEditing({ ...editing, commission_pct: e.target.value === '' ? null : Number(e.target.value) })}
                    className="bg-background border-border h-11 mt-1.5"
                  />
                </div>
              </div>
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
