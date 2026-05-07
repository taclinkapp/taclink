import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureConversation,
  sendMessage,
  BookingGateError,
  type ConversationRow,
  type MessageRow,
} from "@/lib/messaging";
import { useIdentity } from "@/hooks/useIdentity";
import { Send, Loader2, ShieldAlert, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectContactInfo } from "@/lib/contactRedaction";
import { logBypassAttempt } from "@/lib/bypassLogging";
import { ContactInfoWarning } from "@/components/ContactInfoWarning";
import { toast } from "sonner";

type Props = {
  variant: "student" | "instructor";
};

/**
 * Route shapes supported:
 *  - /student/messages/:id  where id is either a conversationId (uuid) or an instructorId
 *  - /instructor/messages/:id where id is a conversationId (uuid) or studentId
 *  - ?courseId= optional, used when starting from a course detail page
 */
export const ConversationView = ({ variant }: Props) => {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const courseId = params.get("courseId");
  const nav = useNavigate();
  const user = useIdentity();

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [gateBlocked, setGateBlocked] = useState(false);
  const [cancelledLock, setCancelledLock] = useState<null | 'student' | 'instructor' | 'generic'>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve / create conversation
  useEffect(() => {
    if (!id || !user) {
      setLoading(false);
      return;
    }
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const run = async () => {
      try {
        // Try as a conversation id first (works for both variants).
        if (isUuid) {
          const { data: convo } = await supabase
            .from("conversations")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (convo) {
            setConversation(convo as ConversationRow);
            return;
          }
        }
        // Otherwise treat the id as the other party's user id and ensure a thread.
        if (variant === "student") {
          const [{ data: instructor }, { data: course }] = await Promise.all([
            supabase.from("profiles").select("display_name, photo_url").eq("id", id).maybeSingle(),
            courseId
              ? supabase.from("courses").select("title").eq("id", courseId).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          const conv = await ensureConversation({
            studentId: user.id,
            studentName: user.name,
            studentPhoto: `https://i.pravatar.cc/100?u=${user.id}`,
            instructorId: id,
            instructorName: instructor?.display_name ?? undefined,
            instructorPhoto: instructor?.photo_url ?? undefined,
            courseId: courseId,
            courseTitle: (course as any)?.title ?? null,
          });
          setConversation(conv);
        } else {
          // instructor opening a thread with a student id directly (no UI for this yet)
          const conv = await ensureConversation({
            studentId: id,
            instructorId: user.id,
            instructorName: user.name,
            courseId: courseId,
          });
          setConversation(conv);
        }
      } catch (e) {
        if (e instanceof BookingGateError) {
          setGateBlocked(true);
        } else {
          console.error("Failed to load conversation", e);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id, courseId, user?.id, variant]);

  // Load messages + subscribe to realtime
  useEffect(() => {
    if (!conversation) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .neq("moderation_status", "flagged")
        .order("created_at", { ascending: true });
      if (error) console.error(error);
      setMessages((data as MessageRow[]) ?? []);
    };
    load();

    const channel = supabase
      .channel(`conv-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            const incoming = payload.new as MessageRow & { moderation_status?: string };
            if (incoming.moderation_status === "flagged") return prev;
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  // Cancellation lock: if every booking between this student/instructor (or
  // for this conversation's course) is cancelled, freeze new messages. The
  // side that cancelled loses the ability to send — but history stays visible.
  useEffect(() => {
    if (!conversation) { setCancelledLock(null); return; }
    let aborted = false;
    (async () => {
      const { data: courses } = await supabase
        .from('courses')
        .select('id, status')
        .eq('instructor_id', conversation.instructor_id);
      const courseRows = (courses ?? []) as Array<{ id: string; status: string }>;
      if (courseRows.length === 0) { if (!aborted) setCancelledLock(null); return; }

      const scoped = conversation.course_id
        ? courseRows.filter((c) => c.id === conversation.course_id)
        : courseRows;
      if (scoped.length === 0) { if (!aborted) setCancelledLock(null); return; }

      // If a specific course tied to this conversation was cancelled, that's
      // an instructor cancellation.
      if (conversation.course_id) {
        const c = scoped[0];
        if (c?.status === 'cancelled') {
          if (!aborted) setCancelledLock('instructor');
          return;
        }
      }

      const { data: bookings } = await supabase
        .from('bookings')
        .select('status, course_id')
        .eq('student_id', conversation.student_id)
        .in('course_id', scoped.map((c) => c.id));

      const rows = (bookings ?? []) as Array<{ status: string; course_id: string }>;
      if (rows.length === 0) { if (!aborted) setCancelledLock(null); return; }
      const allCancelled = rows.every((b) => b.status === 'cancelled');
      if (!allCancelled) { if (!aborted) setCancelledLock(null); return; }

      // If any of the related courses is itself cancelled → instructor side.
      const courseStatusMap = new Map(scoped.map((c) => [c.id, c.status]));
      const instructorCancelled = rows.some(
        (b) => courseStatusMap.get(b.course_id) === 'cancelled',
      );
      if (!aborted) setCancelledLock(instructorCancelled ? 'instructor' : 'student');
    })();
    return () => { aborted = true; };
  }, [conversation?.id, conversation?.course_id, conversation?.instructor_id, conversation?.student_id]);

  // Auto-scroll to newest
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const draftDetections = useMemo(() => detectContactInfo(draft), [draft]);
  const draftBlocked = draftDetections.length > 0;

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !conversation || !user || sending) return;
    if (cancelledLock) {
      toast.error('Messaging closed', {
        description:
          cancelledLock === 'instructor'
            ? 'This course was cancelled by the instructor. Messaging is no longer available.'
            : 'You cancelled this booking. Messaging with this instructor is no longer available.',
      });
      return;
    }

    if (draftBlocked) {
      toast.error('Message blocked', {
        description:
          'Your message contains contact info. All transactions must go through TacLink.',
      });
      logBypassAttempt({
        userId: user.id,
        userRole: variant,
        fieldName: 'message_body',
        originalContent: body,
        detections: draftDetections,
        actionTaken: 'blocked',
        context: { conversation_id: conversation.id },
      });
      return;
    }

    setSending(true);
    setDraft("");
    try {
      await sendMessage(conversation.id, user.id, variant, body);
    } catch (e) {
      console.error(e);
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  const otherName =
    variant === "student" ? conversation?.instructor_name : conversation?.student_name;
  const otherPhoto =
    variant === "student" ? conversation?.instructor_photo : conversation?.student_photo;

  if (gateBlocked) {
    return (
      <MobileShell withTabBar={false}>
        <div className="flex flex-col h-screen">
          <PageHeader back onBack={() => nav(-1)} title="Messaging locked" />
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold">Booking required to message</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              To keep TacLink safe and prevent off-platform bypass, direct messaging
              between students and instructors unlocks once a booking is confirmed.
            </p>
            <Button onClick={() => nav(-1)} className="mt-2">Go back</Button>
          </div>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell withTabBar={false}>
      <div className="flex flex-col h-screen">
        <PageHeader back onBack={() => nav(-1)} title={otherName ?? "Conversation"} />
        {/* Persistent platform-policy banner */}
        <div className="px-3 py-2 border-b border-border bg-primary/5 flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-[11px] leading-snug text-foreground/80">
            <span className="font-bold text-primary">All communication must stay on TacLink.</span>{' '}
            Sharing contact info or arranging off-platform payments may result in account suspension.
          </p>
        </div>

        {conversation?.course_title && (
          <div className="px-4 py-2 border-b border-border bg-card/50">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Course</div>
            <div className="text-xs font-bold text-primary truncate">{conversation.course_title}</div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {!loading && messages.length === 0 && conversation && (
            <div className="text-center py-12">
              <img
                src={otherPhoto ?? `https://i.pravatar.cc/100?u=${conversation.id}`}
                alt=""
                className="h-16 w-16 rounded-full mx-auto mb-3 border-2 border-primary"
              />
              <p className="text-sm font-bold">{otherName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Send a message to start the conversation
              </p>
            </div>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div
                key={m.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border rounded-bl-sm",
                  )}
                >
                  <p className="leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                  <div
                    className={cn(
                      "text-[10px] mt-1 opacity-70",
                      mine ? "text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border bg-surface px-3 pt-2 pb-3">
          {draftBlocked && (
            <ContactInfoWarning value={draft} className="mb-2" />
          )}
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message…"
              className={cn(
                "flex-1 bg-card border-border h-11 rounded-full px-4",
                draftBlocked && "border-destructive focus-visible:ring-destructive",
              )}
              disabled={!user || !conversation}
              aria-invalid={draftBlocked}
            />
            <Button
              onClick={handleSend}
              disabled={!draft.trim() || sending || !conversation || draftBlocked}
              className="h-11 w-11 rounded-full bg-primary text-primary-foreground p-0 amber-glow"
              aria-label={draftBlocked ? "Message blocked — remove contact info" : "Send"}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : draftBlocked ? (
                <ShieldAlert className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </MobileShell>
  );
};
