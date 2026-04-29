import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Sparkles, CheckCircle2, XCircle, Edit3, Loader2, AlertTriangle,
  RefreshCw, Bot, Settings2, Zap, FileText, UserX, Gavel, CloudRain,
  HeartCrack, MessageSquareWarning, Receipt, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type Action = {
  id: string;
  kind: string;
  status: string;
  confidence: number | null;
  risk_level: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, any>;
  edited_payload: Record<string, any> | null;
  preview: string | null;
  reasoning: string | null;
  model: string | null;
  created_at: string;
  error: string | null;
  auto_approved: boolean;
};

type AutoRule = { enabled: boolean; max_risk: "low" | "medium"; min_confidence: number };
type AutoRules = Record<string, AutoRule>;

const KIND_LABEL: Record<string, string> = {
  message_reply: "Message reply",
  support_reply: "Support reply",
  credential_verify: "Credential review",
  course_moderation: "Course moderation",
  review_moderation: "Review moderation",
  refund_recommendation: "Refund decision",
  instructor_nudge: "Instructor nudge",
  dispute_triage: "Dispute / credit request",
};

const KINDS = Object.keys(KIND_LABEL);

const STATUS_TABS = [
  { value: "inbox", label: "Inbox" },
  { value: "auto_paused", label: "Needs decision" },
  { value: "executed", label: "Done" },
  { value: "rejected", label: "Rejected" },
] as const;

export default function OwnerConsole() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["value"]>("inbox");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterKind, setFilterKind] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) toast.error(error.message);
    setActions((data ?? []) as Action[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("ai_actions_inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_actions" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    let list = tab === "inbox"
      ? actions.filter((a) => a.status === "proposed")
      : actions.filter((a) => a.status === tab);
    if (filterKind !== "all") list = list.filter((a) => a.kind === filterKind);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.preview?.toLowerCase().includes(q) ||
          a.reasoning?.toLowerCase().includes(q) ||
          a.kind.includes(q),
      );
    }
    return list;
  }, [actions, tab, filterKind, search]);

  const counts = useMemo(() => ({
    inbox: actions.filter((a) => a.status === "proposed").length,
    auto_paused: actions.filter((a) => a.status === "auto_paused").length,
    executed: actions.filter((a) => a.status === "executed").length,
    rejected: actions.filter((a) => a.status === "rejected").length,
  }), [actions]);

  const autoApprovedToday = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    return actions.filter(
      (a) => a.auto_approved && new Date(a.created_at).getTime() >= cutoff,
    ).length;
  }, [actions]);

  const callExecute = async (actionId: string) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-execute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ action_id: actionId }),
      },
    );
    if (!resp.ok) throw new Error((await resp.text()) || "execute failed");
  };

  const approve = async (a: Action) => {
    setBusyId(a.id);
    try {
      const editedText = edits[a.id];
      let edited_payload: Record<string, any> | null = null;
      if (editedText !== undefined && editedText !== primaryText(a)) {
        edited_payload = { ...a.payload, ...primaryTextField(a, editedText) };
      }
      const { error: updErr } = await supabase
        .from("ai_actions")
        .update({
          status: "approved",
          edited_payload,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", a.id);
      if (updErr) throw updErr;
      await callExecute(a.id);
      toast.success("Action executed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (a: Action) => {
    setBusyId(a.id);
    const { error } = await supabase
      .from("ai_actions")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", a.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success("Rejected");
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(filtered.map((a) => a.id)));
  };
  const clearSelection = () => setSelected(new Set());

  const bulkAction = async (action: "approve" | "reject") => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      if (action === "reject") {
        const { error } = await supabase
          .from("ai_actions")
          .update({ status: "rejected", reviewed_at: new Date().toISOString() })
          .in("id", ids);
        if (error) throw error;
        toast.success(`Rejected ${ids.length} items`);
      } else {
        // Approve: update to approved, then call execute one by one
        const { error } = await supabase
          .from("ai_actions")
          .update({ status: "approved", reviewed_at: new Date().toISOString() })
          .in("id", ids);
        if (error) throw error;
        let ok = 0, fail = 0;
        await Promise.all(
          ids.map(async (id) => {
            try { await callExecute(id); ok++; } catch { fail++; }
          }),
        );
        toast.success(`Approved ${ok}${fail ? ` (${fail} failed)` : ""}`);
      }
      clearSelection();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Owner Cockpit</h1>
            <p className="text-sm text-muted-foreground">
              AI proposes — you approve. Trust rules can auto-handle low-risk items.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {autoApprovedToday > 0 && (
            <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-600">
              <Zap className="h-3.5 w-3.5" />
              {autoApprovedToday} auto-handled today
            </Badge>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/brief"><FileText className="h-4 w-4 mr-2" /> Weekly Brief</Link>
          </Button>
          <TrustSettingsDialog />
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <Input
          placeholder="Search preview, reasoning…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
          className="text-sm bg-background border border-border rounded-md px-3 py-2 h-10"
        >
          <option value="all">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto bg-primary/10 border border-primary/30 rounded-md px-3 py-1.5">
            <span className="text-sm font-semibold">{selected.size} selected</span>
            <Button onClick={() => bulkAction("approve")} disabled={bulkBusy} size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
              {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />} Approve all
            </Button>
            <Button onClick={() => bulkAction("reject")} disabled={bulkBusy} size="sm" variant="outline" className="h-8">
              <XCircle className="h-3 w-3 mr-1" /> Reject all
            </Button>
            <Button onClick={clearSelection} size="sm" variant="ghost" className="h-8">Clear</Button>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); clearSelection(); }}>
        <TabsList>
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-muted text-xs font-bold">
                {counts[t.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4 space-y-3">
            {(t.value === "inbox" || t.value === "auto_paused") && filtered.length > 0 && (
              <button
                onClick={selectAllVisible}
                className="text-xs text-primary hover:underline"
              >
                Select all {filtered.length} visible
              </button>
            )}
            {loading && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="tactical-card p-8 text-center text-sm text-muted-foreground">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nothing here. The AI will queue items as they come in.
              </div>
            )}
            {filtered.map((a) => (
              <ActionCard
                key={a.id}
                a={a}
                editValue={edits[a.id] ?? primaryText(a)}
                onEdit={(v) => setEdits((p) => ({ ...p, [a.id]: v }))}
                onApprove={() => approve(a)}
                onReject={() => reject(a)}
                busy={busyId === a.id}
                showActions={t.value === "inbox" || t.value === "auto_paused"}
                selected={selected.has(a.id)}
                onToggleSelect={() => toggleSelect(a.id)}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TrustSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<AutoRules | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("ai_auto_approve_settings")
        .select("rules")
        .eq("id", 1)
        .maybeSingle();
      setRules((data?.rules ?? {}) as AutoRules);
    })();
  }, [open]);

  const save = async () => {
    if (!rules) return;
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("ai_auto_approve_settings")
      .update({ rules, updated_by: sess.session?.user.id })
      .eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Trust rules saved"); setOpen(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" /> Trust rules
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auto-approval trust rules</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          When enabled, AI actions matching these criteria run automatically without your approval.
          Higher-risk or lower-confidence items still queue in your inbox.
        </p>
        <div className="space-y-4 mt-2">
          {rules && KINDS.map((kind) => {
            const r = rules[kind] ?? { enabled: false, max_risk: "low", min_confidence: 0.85 };
            return (
              <div key={kind} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{KIND_LABEL[kind]}</div>
                    <div className="text-xs text-muted-foreground">
                      {kind === "refund_recommendation" || kind === "credential_verify" || kind === "dispute_triage"
                        ? "⚠️ Money/identity decision — recommend keeping manual"
                        : kind === "course_moderation" || kind === "support_reply"
                        ? "Sensitive — review carefully before enabling"
                        : "Safe to auto-handle when confidence is high"}
                    </div>
                  </div>
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) =>
                      setRules({ ...rules, [kind]: { ...r, enabled: v } })
                    }
                  />
                </div>
                {r.enabled && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Max risk to auto-approve
                      </label>
                      <div className="flex gap-2 mt-1">
                        {(["low", "medium"] as const).map((risk) => (
                          <Button
                            key={risk}
                            size="sm"
                            variant={r.max_risk === risk ? "default" : "outline"}
                            onClick={() => setRules({ ...rules, [kind]: { ...r, max_risk: risk } })}
                            className="h-8 text-xs capitalize"
                          >
                            {risk}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Minimum confidence: {Math.round(r.min_confidence * 100)}%
                      </label>
                      <Slider
                        value={[r.min_confidence * 100]}
                        onValueChange={([v]) =>
                          setRules({ ...rules, [kind]: { ...r, min_confidence: v / 100 } })
                        }
                        min={50} max={100} step={5}
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save trust rules
          </Button>
          <Button onClick={() => setOpen(false)} variant="outline">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionCard({
  a, editValue, onEdit, onApprove, onReject, busy, showActions, selected, onToggleSelect,
}: {
  a: Action;
  editValue: string;
  onEdit: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
  showActions: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const conf = a.confidence != null ? Math.round(a.confidence * 100) : null;
  const riskColor =
    a.risk_level === "high"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : a.risk_level === "medium"
        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
  const editable = isEditable(a);

  return (
    <div className={cn("tactical-card p-4 space-y-3 transition-colors", selected && "ring-2 ring-primary")}>
      <div className="flex items-start gap-3">
        {showActions && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-1.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] uppercase">
              {KIND_LABEL[a.kind] ?? a.kind}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] uppercase border", riskColor)}>
              {a.risk_level} risk
            </Badge>
            {conf !== null && (
              <Badge variant="outline" className="text-[10px] uppercase">{conf}% confident</Badge>
            )}
            {a.auto_approved && (
              <Badge variant="outline" className="text-[10px] uppercase border-emerald-500/40 text-emerald-600">
                <Zap className="h-3 w-3 mr-1" /> auto-handled
              </Badge>
            )}
            {a.status === "auto_paused" && (
              <Badge variant="outline" className="text-[10px] uppercase border-amber-500/40 text-amber-600">
                <AlertTriangle className="h-3 w-3 mr-1" /> auto-paused
              </Badge>
            )}
            {a.status === "failed" && (
              <Badge variant="outline" className="text-[10px] uppercase border-destructive/40 text-destructive">failed</Badge>
            )}
          </div>
          <div className="mt-2 text-sm font-semibold">{a.preview ?? "(no preview)"}</div>
          {a.reasoning && <div className="mt-1 text-xs text-muted-foreground">{a.reasoning}</div>}
        </div>
      </div>

      {editable ? (
        <Textarea
          value={editValue}
          onChange={(e) => onEdit(e.target.value)}
          className="min-h-[90px] text-sm bg-background"
          disabled={!showActions}
        />
      ) : (
        <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto">
          {JSON.stringify(a.edited_payload ?? a.payload, null, 2)}
        </pre>
      )}

      {a.error && <div className="text-xs text-destructive">Error: {a.error}</div>}

      {showActions && (
        <div className="flex gap-2 pt-1">
          <Button onClick={onApprove} disabled={busy} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Approve & execute
          </Button>
          <Button onClick={onReject} disabled={busy} size="sm" variant="outline">
            <XCircle className="h-4 w-4 mr-1" /> Reject
          </Button>
          {editable && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground self-center">
              <Edit3 className="h-3 w-3 inline mr-1" /> Edit before approving
            </span>
          )}
        </div>
      )}

      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {new Date(a.created_at).toLocaleString()} · {a.model ?? "ai"}
      </div>
    </div>
  );
}

function primaryText(a: Action): string {
  const p = a.edited_payload ?? a.payload ?? {};
  return p.reply_text ?? p.message ?? p.notes ?? p.reason ?? "";
}
function primaryTextField(a: Action, v: string): Record<string, any> {
  const p = a.payload ?? {};
  if ("reply_text" in p) return { reply_text: v };
  if ("message" in p) return { message: v };
  if ("notes" in p) return { notes: v };
  if ("reason" in p) return { reason: v };
  return {};
}
function isEditable(a: Action): boolean {
  return ["message_reply", "support_reply", "instructor_nudge"].includes(a.kind);
}
