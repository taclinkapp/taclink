import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, ShieldAlert, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { ConversationRow, MessageRow } from "@/lib/messaging";
import { cn } from "@/lib/utils";

type AdminMessage = MessageRow & { is_flagged?: boolean; flag_reason?: string | null };

export const AdminConversationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [conv, setConv] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: m }] = await Promise.all([
        supabase.from("conversations").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true }),
      ]);
      setConv((c as ConversationRow) ?? null);
      setMessages((m as AdminMessage[]) ?? []);
      setLoading(false);
    })();
  }, [id]);

  const toggleFlag = async (msg: AdminMessage) => {
    const next = !msg.is_flagged;
    const { error } = await supabase
      .from("messages")
      .update({
        is_flagged: next,
        flag_reason: next ? reason.trim() || "admin_flag" : null,
      })
      .eq("id", msg.id);
    if (error) {
      toast.error("Could not update flag", { description: error.message });
      return;
    }
    setMessages((prev) =>
      prev.map((x) =>
        x.id === msg.id
          ? { ...x, is_flagged: next, flag_reason: next ? reason.trim() || "admin_flag" : null }
          : x,
      ),
    );
    toast.success(next ? "Message flagged" : "Flag cleared");
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="p-6">
        <Link to="/admin/conversations" className="text-primary text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="mt-6 text-muted-foreground">Conversation not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link
          to="/admin/conversations"
          className="text-primary text-sm flex items-center gap-1 font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> All conversations
        </Link>
        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-primary font-bold bg-primary/10 px-2 py-1 rounded">
          <Lock className="h-3 w-3" /> Admin override
        </span>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Student</div>
            <div className="font-bold">{conv.student_name ?? conv.student_id}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Instructor</div>
            <div className="font-bold">{conv.instructor_name ?? conv.instructor_id}</div>
          </div>
          {conv.course_title && (
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Course</div>
              <div className="text-primary font-semibold">{conv.course_title}</div>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
          Flag reason (optional, applied to next flag action)
        </label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. shared phone number, attempted off-platform payment"
          className="mt-1 min-h-16"
        />
      </div>

      <div className="space-y-2">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No messages in this conversation yet.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "border rounded-xl p-3 text-sm",
              m.is_flagged
                ? "border-destructive/60 bg-destructive/5"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {m.sender_role} · {new Date(m.created_at).toLocaleString()}
              </div>
              <Button
                size="sm"
                variant={m.is_flagged ? "outline" : "destructive"}
                onClick={() => toggleFlag(m)}
                className="h-7 text-xs gap-1"
              >
                {m.is_flagged ? (
                  <>
                    <ShieldCheck className="h-3 w-3" /> Clear flag
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3 w-3" /> Flag
                  </>
                )}
              </Button>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words">{m.body}</p>
            {m.is_flagged && m.flag_reason && (
              <div className="mt-2 text-[11px] text-destructive font-semibold">
                Reason: {m.flag_reason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
