import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminHeader } from "./AdminDashboard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Crown, Loader2, Search, ShieldOff, Sliders, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FounderRow = {
  id: string;
  user_id: string;
  founder_rank: number;
  qualified_at: string;
  launch_date_used: string | null;
  free_pro_starts_at: string | null;
  free_pro_ends_at: string | null;
  founder_status: "pending_prelaunch" | "active" | "expired" | "revoked";
  revoked_at: string | null;
  revoked_reason: string | null;
  notes: string | null;
  override_plan_id: string | null;
  override_enabled: boolean;
  override_updated_at: string | null;
};

type Plan = { id: string; slug: string; name: string };

type EnrichedRow = FounderRow & { display_name: string | null; photo_url: string | null };

type StatusKey = "all" | "pending_prelaunch" | "active" | "expired" | "revoked";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const statusStyles: Record<FounderRow["founder_status"], string> = {
  pending_prelaunch: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
  active: "bg-primary/15 text-primary border-primary/40",
  expired: "bg-muted text-muted-foreground border-border",
  revoked: "bg-destructive/15 text-destructive border-destructive/40",
};

const statusLabel: Record<FounderRow["founder_status"], string> = {
  pending_prelaunch: "Pending",
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

export default function AdminFoundingInstructors() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<StatusKey>("all");
  const [search, setSearch] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<EnrichedRow | null>(null);
  const [editTarget, setEditTarget] = useState<EnrichedRow | null>(null);

  const plans = useQuery({
    queryKey: ["instructor_plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, slug, name")
        .eq("active", true)
        .in("audience", ["instructor", "all"])
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
    staleTime: 60_000,
  });

  const stats = useQuery({
    queryKey: ["founder_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_founder_program_stats");
      if (error) throw error;
      return data as {
        cap: number; claimed: number; remaining: number;
        pending_prelaunch: number; active: number; expired: number; revoked: number;
      };
    },
    staleTime: 15_000,
  });

  const roster = useQuery({
    queryKey: ["founder_roster"],
    queryFn: async (): Promise<EnrichedRow[]> => {
      const { data: rows, error } = await supabase
        .from("founding_instructors")
        .select("*")
        .order("founder_rank", { ascending: true });
      if (error) throw error;
      const ids = (rows ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase.rpc("get_public_profile_cards", { _ids: ids });
      const map = new Map<string, { display_name: string | null; photo_url: string | null }>();
      (profiles as any[] | null)?.forEach((p) => map.set(p.id, { display_name: p.display_name, photo_url: p.photo_url }));
      return (rows as FounderRow[]).map((r) => ({
        ...r,
        display_name: map.get(r.user_id)?.display_name ?? null,
        photo_url: map.get(r.user_id)?.photo_url ?? null,
      }));
    },
    staleTime: 15_000,
  });

  const filtered = useMemo(() => {
    const list = roster.data ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (tab !== "all" && r.founder_status !== tab) return false;
      if (!q) return true;
      return (
        (r.display_name ?? "").toLowerCase().includes(q) ||
        r.user_id.toLowerCase().includes(q) ||
        String(r.founder_rank).includes(q)
      );
    });
  }, [roster.data, tab, search]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["founder_stats"] });
    qc.invalidateQueries({ queryKey: ["founder_roster"] });
  };

  return (
    <div className="space-y-4">
      <AdminHeader
        title="Founding Instructors"
        subtitle="First 1,000 qualifying instructors get 6 months of Pro free starting on launch day."
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatTile label="Claimed" value={stats.data ? `${stats.data.claimed} / ${stats.data.cap}` : "—"} primary />
        <StatTile label="Remaining" value={stats.data?.remaining ?? "—"} />
        <StatTile label="Pending" value={stats.data?.pending_prelaunch ?? "—"} />
        <StatTile label="Active" value={stats.data?.active ?? "—"} />
        <StatTile label="Expired / revoked" value={stats.data ? stats.data.expired + stats.data.revoked : "—"} />
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as StatusKey)} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-5 w-full md:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending_prelaunch">Pending</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
            <TabsTrigger value="revoked">Revoked</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, user id, rank"
              className="pl-8"
            />
          </div>
          <Button onClick={() => setGrantOpen(true)} className="bg-primary text-primary-foreground">
            <UserPlus className="h-4 w-4 mr-1.5" /> Grant
          </Button>
        </div>
      </div>

      {/* Roster table */}
      <div className="tactical-card overflow-hidden">
        {roster.isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No founders match this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Rank</th>
                  <th className="text-left px-3 py-2">Instructor</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Plan</th>
                  <th className="text-left px-3 py-2">Access window</th>
                  <th className="text-left px-3 py-2">Access</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const planName = plans.data?.find((p) => p.id === r.override_plan_id)?.name ?? "—";
                  return (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="px-3 py-2 font-mono text-xs">#{r.founder_rank}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.display_name ?? "Unknown"}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{r.user_id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        statusStyles[r.founder_status],
                      )}>
                        {r.founder_status === "active" && <Crown className="h-3 w-3" />}
                        {statusLabel[r.founder_status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{planName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.free_pro_starts_at
                        ? <>{fmtDate(r.free_pro_starts_at)} → {fmtDate(r.free_pro_ends_at)}</>
                        : <span className="italic">Starts on launch</span>}
                      {r.founder_status === "revoked" && r.revoked_reason && (
                        <div className="text-destructive mt-0.5 truncate max-w-xs" title={r.revoked_reason}>
                          {r.revoked_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Switch
                        checked={r.override_enabled}
                        disabled={r.founder_status === "revoked"}
                        onCheckedChange={async (checked) => {
                          try {
                            const { error } = await supabase.rpc(
                              "admin_toggle_founder_access" as any,
                              { _user_id: r.user_id, _enabled: checked } as any,
                            );
                            if (error) throw error;
                            toast.success(checked ? "Access enabled" : "Access disabled");
                            refreshAll();
                          } catch (e: any) {
                            toast.error(e?.message ?? "Toggle failed");
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditTarget(r)}
                        >
                          <Sliders className="h-3.5 w-3.5 mr-1" /> Edit access
                        </Button>
                        {r.founder_status !== "revoked" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setRevokeTarget(r)}
                          >
                            <ShieldOff className="h-3.5 w-3.5 mr-1" /> Revoke
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GrantDialog open={grantOpen} onOpenChange={setGrantOpen} onGranted={refreshAll} />
      <RevokeDialog target={revokeTarget} onClose={() => setRevokeTarget(null)} onRevoked={refreshAll} />
      <EditAccessDialog
        target={editTarget}
        plans={plans.data ?? []}
        onClose={() => setEditTarget(null)}
        onSaved={refreshAll}
      />
    </div>
  );
}

const StatTile = ({ label, value, primary }: { label: string; value: any; primary?: boolean }) => (
  <div className={cn("tactical-card p-3", primary && "border-primary/40 bg-primary/5")}>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={cn("text-2xl font-black mt-0.5", primary && "text-primary")}>{value}</div>
  </div>
);

function GrantDialog({
  open, onOpenChange, onGranted,
}: { open: boolean; onOpenChange: (v: boolean) => void; onGranted: () => void }) {
  const [userId, setUserId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const id = userId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      toast.error("Enter a valid user UUID");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("admin_grant_founder", {
        _user_id: id,
        _note: note.trim() || null,
      });
      if (error) throw error;
      toast.success(`Founder granted: rank #${(data as any)?.founder_rank ?? "?"}`);
      setUserId(""); setNote("");
      onOpenChange(false);
      onGranted();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not grant founder");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant founding instructor</DialogTitle>
          <DialogDescription>
            Manually assign the next available founder rank. Subject to the 1,000-slot cap and instructor-role check.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">User ID</label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="font-mono text-xs mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Note (optional)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this manual grant"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !userId.trim()} className="bg-primary text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant founder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({
  target, onClose, onRevoked,
}: { target: EnrichedRow | null; onClose: () => void; onRevoked: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!target) return;
    if (reason.trim().length < 4) {
      toast.error("Please give a short reason");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_revoke_founder", {
        _user_id: target.user_id,
        _reason: reason.trim(),
      });
      if (error) throw error;
      toast.success("Founder revoked");
      setReason("");
      onClose();
      onRevoked();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not revoke founder");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke founder status</DialogTitle>
          <DialogDescription>
            {target?.display_name ?? "Instructor"} · rank #{target?.founder_rank}. This frees nothing — the rank stays
            consumed, but the user loses founder-based Pro entitlement immediately.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this founder is being revoked"
            rows={3}
            className="mt-1"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}><X className="h-4 w-4 mr-1" />Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function EditAccessDialog({
  target, plans, onClose, onSaved,
}: {
  target: EnrichedRow | null;
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState<string>("");
  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");
  const [enabled, setEnabled] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useMemo(() => {
    if (!target) return;
    setPlanId(target.override_plan_id ?? plans[0]?.id ?? "");
    setStartsAt(toInputDate(target.free_pro_starts_at) || toInputDate(new Date().toISOString()));
    setEndsAt(toInputDate(target.free_pro_ends_at));
    setEnabled(target.override_enabled);
    setNote("");
  }, [target?.id, plans]);

  const applyPreset = (months: number | "lifetime") => {
    const base = startsAt ? new Date(startsAt) : new Date();
    if (months === "lifetime") {
      setEndsAt("");
      return;
    }
    const end = new Date(base);
    end.setMonth(end.getMonth() + months);
    setEndsAt(end.toISOString().slice(0, 10));
  };

  const submit = async () => {
    if (!target) return;
    if (!planId) { toast.error("Pick a plan"); return; }
    if (!startsAt) { toast.error("Pick a start date"); return; }
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      toast.error("End date must be after start date"); return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_set_founder_access" as any, {
        _user_id: target.user_id,
        _plan_id: planId,
        _starts_at: new Date(startsAt).toISOString(),
        _ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        _enabled: enabled,
        _note: note.trim() || null,
      } as any);
      if (error) throw error;

      // Validate by re-reading the row + checking entitlement
      const { data: row } = await supabase
        .from("founding_instructors")
        .select("override_enabled, override_plan_id, free_pro_starts_at, free_pro_ends_at, founder_status")
        .eq("user_id", target.user_id)
        .maybeSingle();
      const planSlug = plans.find((p) => p.id === planId)?.slug;
      const isPro = planSlug === "instructor_pro_monthly";
      const r = row as any;
      const windowOk = r && r.override_enabled === enabled
        && r.override_plan_id === planId
        && (!endsAt || (r.free_pro_ends_at && new Date(r.free_pro_ends_at).toISOString().slice(0,10) === endsAt));
      if (!windowOk) {
        toast.warning("Saved but verification mismatch — refresh to confirm");
      } else if (enabled && isPro) {
        toast.success("Access updated · Pro entitlement is live");
      } else {
        toast.success(enabled ? "Access updated" : "Access disabled");
      }
      onClose();
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update access");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit founder access</DialogTitle>
          <DialogDescription>
            {target?.display_name ?? "Instructor"} · rank #{target?.founder_rank}. Choose any plan, set a window, and
            toggle access on or off.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plan</label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} <span className="text-muted-foreground text-xs ml-1">({p.slug})</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Starts</label>
              <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ends</label>
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1" placeholder="Lifetime" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[1, 3, 6, 12].map((m) => (
              <Button key={m} type="button" size="sm" variant="outline" onClick={() => applyPreset(m)}>
                {m} mo
              </Button>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => applyPreset("lifetime")}>
              Lifetime
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-semibold">Access enabled</div>
              <div className="text-xs text-muted-foreground">Off cuts entitlement instantly without losing the rank.</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Note (optional)</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-primary text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
