import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Sparkles, X, Send, Loader2, ShieldCheck, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAdminTabContext } from "@/components/admin/adminTabContext";
import {
  useAdminUserAction,
  useAdminCourseAction,
  useUpdateSetting,
  useUpdateFlag,
  useGrantCredit,
  useIssueRefund,
} from "@/hooks/useAdminData";

type Proposal = { id: string; name: string; args: any; status?: "pending" | "running" | "done" | "error"; error?: string };
type Msg = { role: "user" | "assistant"; content: string; proposals?: Proposal[] };

const QUICK = [
  { label: "Platform health", prompt: "Give me a health snapshot of the platform right now." },
  { label: "Triage open bugs", prompt: "Show me the latest open issue reports and group them by likely root cause." },
  { label: "Stuck deposits", prompt: "How many bookings have stuck deposits past expiry, and what should I do?" },
  { label: "Recent admin actions", prompt: "Summarize the last 20 admin actions from the audit log." },
];

export function AdminAIPanel() {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Record<string, Msg[]>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const tab = getAdminTabContext(location.pathname);
  const threadKey = tab?.path ?? "__global__";
  const messages = threads[threadKey] ?? [];
  const setMessages = (updater: Msg[] | ((prev: Msg[]) => Msg[])) =>
    setThreads((prev) => {
      const current = prev[threadKey] ?? [];
      const next = typeof updater === "function" ? (updater as (p: Msg[]) => Msg[])(current) : updater;
      return { ...prev, [threadKey]: next };
    });

  const userAction = useAdminUserAction();
  const courseAction = useAdminCourseAction();
  const settingMut = useUpdateSetting();
  const flagMut = useUpdateFlag();
  const grantMut = useGrantCredit();
  const refundMut = useIssueRefund();

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  // Per-tab threads are preserved across navigation; no reset on tab change.

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-ai", {
        body: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context: tab ? { tab } : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const proposals: Proposal[] = (data?.proposals ?? []).map((p: any) => ({ ...p, status: "pending" }));
      setMessages((prev) => [...prev, { role: "assistant", content: data?.content ?? "", proposals }]);
    } catch (e: any) {
      toast.error(e.message ?? "Admin AI failed");
    } finally {
      setLoading(false);
    }
  };

  const runProposal = async (msgIdx: number, p: Proposal) => {
    const setStatus = (status: Proposal["status"], errMsg?: string) =>
      setMessages((prev) =>
        prev.map((m, i) => {
          if (i !== msgIdx || !m.proposals) return m;
          return { ...m, proposals: m.proposals.map((q) => (q.id === p.id ? { ...q, status, error: errMsg } : q)) };
        }),
      );
    setStatus("running");
    try {
      const a = p.args;
      switch (p.name) {
        case "propose_user_action":
          await userAction.mutateAsync({ action: a.action, userId: a.user_id, reason: a.reason });
          break;
        case "propose_course_action":
          await courseAction.mutateAsync({ action: a.action, courseId: a.course_id, reason: a.reason });
          break;
        case "propose_setting_update":
          await settingMut.mutateAsync({ key: a.key, value: a.new_value });
          break;
        case "propose_flag_toggle":
          await flagMut.mutateAsync({ key: a.key, patch: { enabled: a.enabled } });
          break;
        case "propose_grant_credit":
          await grantMut.mutateAsync({ userType: a.user_type, userId: a.user_id, note: a.note });
          break;
        case "propose_refund":
          await refundMut.mutateAsync({
            bookingId: a.booking_id,
            studentId: a.student_id,
            amountCents: a.amount_cents,
            refundType: a.refund_type,
            reason: a.reason,
            notes: a.notes,
          });
          break;
        default:
          throw new Error(`Unknown proposal: ${p.name}`);
      }
      setStatus("done");
    } catch (e: any) {
      setStatus("error", e.message ?? "Failed");
      toast.error(e.message ?? "Action failed");
    }
  };

  return (
    <>
      <button
        aria-label="Admin AI"
        onClick={() => setOpen(true)}
        className="fixed z-50 bottom-6 right-6 h-14 w-14 rounded-full shadow-xl bg-gradient-to-br from-primary to-orange-500 text-primary-foreground flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <ShieldCheck className="h-6 w-6" strokeWidth={2.25} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg h-[85vh] sm:h-[80vh] sm:rounded-2xl bg-surface border border-border flex flex-col overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary to-orange-500">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
              <div className="flex-1">
                <div className="text-sm font-bold text-primary-foreground">Admin Copilot</div>
                <div className="text-[10px] uppercase tracking-wider text-primary-foreground/80">
                  {tab ? `Focused on: ${tab.label}` : "Diagnostics • Triage • Guided actions"}
                </div>
              </div>
              {messages.length > 0 && (
                <Button onClick={() => setMessages([])} size="sm" variant="ghost" className="h-8 text-primary-foreground hover:bg-white/10 text-xs">
                  New
                </Button>
              )}
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center text-primary-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    I can answer questions about platform state, triage bugs, and propose admin actions for you to confirm.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => send(q.prompt)}
                        className="tactical-card p-3 text-left text-xs font-semibold hover:border-primary/50 transition-colors"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-foreground",
                      )}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5">
                          <ReactMarkdown>{m.content || "_(no message)_"}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {m.proposals?.map((p) => (
                      <ProposalCard key={p.id} p={p} onRun={() => runProposal(i, p)} />
                    ))}
                  </div>
                ))
              )}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              )}
            </div>

            <div className="border-t border-border p-3 bg-card">
              <div className="flex gap-2 items-end">
                <Textarea
                  key="admin-ai-input"
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Ask anything, or 'suspend user X', 'set platform_fee_cents to 3000'…"
                  className="min-h-[44px] max-h-32 resize-none bg-background border-border text-sm"
                  rows={1}
                />
                <Button onClick={() => send(input)} disabled={loading || !input.trim()} className="h-11 w-11 p-0 bg-primary text-primary-foreground">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProposalCard({ p, onRun }: { p: Proposal; onRun: () => void }) {
  const a = p.args;
  const summary = describeProposal(p.name, a);
  return (
    <div className="w-full max-w-[92%] tactical-card p-3 border-orange-500/40">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-orange-400 mb-1">
        <AlertTriangle className="h-3.5 w-3.5" /> Proposed action
      </div>
      <div className="text-sm font-semibold mb-1">{summary.title}</div>
      <div className="text-xs text-muted-foreground mb-2">{summary.detail}</div>
      {a.reason && <div className="text-[11px] italic text-muted-foreground mb-3">"{a.reason}"</div>}
      {p.status === "done" ? (
        <div className="flex items-center gap-1.5 text-xs font-bold text-success">
          <Check className="h-3.5 w-3.5" /> Done
        </div>
      ) : p.status === "error" ? (
        <div className="text-xs text-destructive">Failed: {p.error}</div>
      ) : (
        <Button onClick={onRun} disabled={p.status === "running"} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs font-bold">
          {p.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Run action"}
        </Button>
      )}
    </div>
  );
}

function describeProposal(name: string, a: any): { title: string; detail: string } {
  switch (name) {
    case "propose_user_action":
      return { title: `${labelMap[a.action] ?? a.action} user`, detail: `${a.user_label ?? a.user_id}` };
    case "propose_course_action":
      return { title: `${labelMap[a.action] ?? a.action} course`, detail: `${a.course_label ?? a.course_id}` };
    case "propose_setting_update":
      return { title: `Update setting`, detail: `${a.key} → ${JSON.stringify(a.new_value)}` };
    case "propose_flag_toggle":
      return { title: `${a.enabled ? "Enable" : "Disable"} flag`, detail: a.key };
    case "propose_grant_credit":
      return { title: `Grant ${a.user_type} credit`, detail: a.user_label ?? a.user_id };
    case "propose_refund":
      return { title: `Issue ${a.refund_type} refund`, detail: `Booking ${a.booking_id} · $${(a.amount_cents / 100).toFixed(2)}` };
    default:
      return { title: name, detail: JSON.stringify(a) };
  }
}

const labelMap: Record<string, string> = {
  suspend: "Suspend",
  reactivate: "Reactivate",
  reset_strikes: "Reset strikes for",
  grant_admin: "Grant admin to",
  revoke_admin: "Revoke admin from",
  publish: "Publish",
  unpublish: "Unpublish",
  approve_moderation: "Approve moderation for",
  reject_moderation: "Reject moderation for",
};
