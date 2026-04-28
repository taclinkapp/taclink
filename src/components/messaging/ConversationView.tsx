import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { mockCourses } from "@/lib/mockData";
import {
  ensureConversation,
  sendMessage,
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
        if (isUuid) {
          const { data, error } = await supabase
            .from("conversations")
            .select("*")
            .eq("id", id)
            .single();
          if (error) throw error;
          setConversation(data as ConversationRow);
        } else if (variant === "student") {
          // id is the instructor id; look up details from mock data
          const course = courseId ? mockCourses.find((c) => c.id === courseId) : null;
          const sample = mockCourses.find((c) => c.instructorId === id);
          const conv = await ensureConversation({
            studentId: user.id,
            studentName: user.name,
            studentPhoto: `https://i.pravatar.cc/100?u=${user.id}`,
            instructorId: id,
            instructorName: sample?.instructorName,
            instructorPhoto: sample?.instructorPhoto,
            courseId: courseId,
            courseTitle: course?.title ?? null,
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
        console.error("Failed to load conversation", e);
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
            const incoming = payload.new as MessageRow;
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

  // Auto-scroll to newest
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const draftDetections = useMemo(() => detectContactInfo(draft), [draft]);
  const draftBlocked = draftDetections.length > 0;

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !conversation || !user || sending) return;

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

  return (
    <MobileShell withTabBar={false}>
      <div className="flex flex-col h-screen">
        <PageHeader back onBack={() => nav(-1)} title={otherName ?? "Conversation"} />
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

        <div className="border-t border-border bg-surface px-3 py-3 flex items-center gap-2">
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
            className="flex-1 bg-card border-border h-11 rounded-full px-4"
            disabled={!user || !conversation}
          />
          <Button
            onClick={handleSend}
            disabled={!draft.trim() || sending || !conversation}
            className="h-11 w-11 rounded-full bg-primary text-primary-foreground p-0 amber-glow"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </MobileShell>
  );
};
