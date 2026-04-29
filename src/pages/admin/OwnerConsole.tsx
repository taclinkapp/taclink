import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Edit3,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
};

const KIND_LABEL: Record<string, string> = {
  message_reply: "Message reply",
  support_reply: "Support reply",
  credential_verify: "Credential review",
  course_moderation: "Course moderation",
  review_moderation: "Review moderation",
  refund_recommendation: "Refund decision",
  instructor_nudge: "Instructor nudge",
};

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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
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
    if (tab === "inbox")
      return actions.filter((a) => a.status === "proposed");
    return actions.filter((a) => a.status === tab);
  }, [actions, tab]);

  const counts = useMemo(() => {
    return {
      inbox: actions.filter((a) => a.status === "proposed").length,
      auto_paused: actions.filter((a) => a.status === "auto_paused").length,
      executed: actions.filter((a) => a.status === "executed").length,
      rejected: actions.filter((a) => a.status === "rejected").length,
    };
  }, [actions]);

  const approve = async (a: Action) => {
    setBusyId(a.id);
    try {
      // Apply user edits to payload (if any). We store the entire payload back
      // with the edited "primary text" field swapped in.
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

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? ""}`,
          },
          body: JSON.stringify({ action_id: a.id }),
        },
      );
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || "execute failed");
      }
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
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", a.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success("Rejected");
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Owner Console</h1>
            <p className="text-sm text-muted-foreground">
              AI proposes — you approve. Everything that needs your attention, in one place.
            </p>
          </div>
        </div>
        <Button onClick={load} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
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
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ActionCard({
  a,
  editValue,
  onEdit,
  onApprove,
  onReject,
  busy,
  showActions,
}: {
  a: Action;
  editValue: string;
  onEdit: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
  showActions: boolean;
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
    <div className="tactical-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] uppercase">
              {KIND_LABEL[a.kind] ?? a.kind}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] uppercase border", riskColor)}>
              {a.risk_level} risk
            </Badge>
            {conf !== null && (
              <Badge variant="outline" className="text-[10px] uppercase">
                {conf}% confident
              </Badge>
            )}
            {a.status === "auto_paused" && (
              <Badge variant="outline" className="text-[10px] uppercase border-amber-500/40 text-amber-600">
                <AlertTriangle className="h-3 w-3 mr-1" /> auto-paused
              </Badge>
            )}
            {a.status === "failed" && (
              <Badge variant="outline" className="text-[10px] uppercase border-destructive/40 text-destructive">
                failed
              </Badge>
            )}
          </div>
          <div className="mt-2 text-sm font-semibold">{a.preview ?? "(no preview)"}</div>
          {a.reasoning && (
            <div className="mt-1 text-xs text-muted-foreground">{a.reasoning}</div>
          )}
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

      {a.error && (
        <div className="text-xs text-destructive">Error: {a.error}</div>
      )}

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
              <Edit3 className="h-3 w-3 inline mr-1" />
              Edit before approving
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
